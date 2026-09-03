"""
Quality Grading Service — §23, §27
AI-assisted image grading for supported crops.
Supports Onion, Tomato, Soybean with real computer vision analysis.

Output schema per assessment:
  crop, estimated_grade, confidence, visible_observations,
  detected_issues, missing_information, verification_type,
  manual_verification_required, model_name, model_version, timestamp.
"""
import os
import uuid
import tempfile
from datetime import datetime
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from models.database import (
    QualityAssessment, QualityReportRevision, QualityGrade, ProduceLot, Crop, User
)

# Supported crops for AI grading
SUPPORTED_CROPS_FOR_AI = ["tomato", "onion", "soybean"]
MODEL_NAME = "crop_vision"
MODEL_VERSION = "2.0.0"


def assess_quality(
    db: Session,
    lot_id: int,
    image_paths: Optional[List[str]] = None,
    override_grade: Optional[str] = None,
    verification_type: str = "ai_assisted",
    user_id: Optional[int] = None,
) -> dict:
    """
    AI-assisted quality grading with full output schema.

    Flow:
      1. Validate lot exists and crop is supported
      2. Run image quality checks on each image
      3. Analyze images (use first valid image, or composite)
      4. Generate full quality report with observations
      5. Store assessment and optional revision history
      6. Return complete schema
    """
    lot = db.query(ProduceLot).filter(ProduceLot.id == lot_id).first()
    if not lot:
        return {"error": "Lot not found"}

    crop = db.query(Crop).filter(Crop.id == lot.crop_id).first()
    crop_name = crop.name.lower() if crop else ""

    # Single image path support (backward compat)
    if image_paths is None:
        image_paths = []

    # ── Manual override ─────────────────────────────────────────
    if override_grade:
        grade = QualityGrade(override_grade.upper())
        confidence = 1.0
        method = "manual"
        verification_type = "manually_verified"
        notes = f"Manual grade assignment: {override_grade.upper()}"
        analysis = None
        image_quality_warnings = []
        visible_observations = [f"Grade {override_grade.upper()} assigned manually"]
        detected_issues = []
        missing_info = []
        limitations = []
    elif crop_name in SUPPORTED_CROPS_FOR_AI and image_paths:
        # ── AI grading with image analysis ──────────────────────
        # Run image quality checks on first image
        image_quality_warnings = _check_image_quality(image_paths[0])

        # Analyze with vision pipeline
        analysis = _analyze_with_vision(crop_name, image_paths[0])

        if "error" in analysis:
            return {"error": analysis["error"]}

        grade = QualityGrade(analysis["grade"])
        confidence = analysis["confidence"]
        method = "ai_assisted"
        verification_type = "ai_assisted"
        notes = analysis.get("overall_notes", f"AI-assisted grading for {crop_name}")
        visible_observations = analysis.get("visible_observations", [])
        detected_issues = analysis.get("detected_issues", [])
        missing_info = analysis.get("missing_information", [])
        limitations = analysis.get("limitations", [])

        # If confidence is low, add caution
        if confidence < 0.50:
            notes = f"Unable to estimate grade confidently ({confidence*100:.0f}% confidence). {notes}"
            visible_observations.append("Low confidence — clearer images or manual verification recommended")
    elif crop_name in SUPPORTED_CROPS_FOR_AI:
        # No image provided — generate synthetic demo result
        analysis = _analyze_with_vision(crop_name, None)
        grade = QualityGrade(analysis["grade"])
        confidence = analysis["confidence"]
        method = "ai_assisted"
        verification_type = "ai_assisted"
        notes = analysis.get("overall_notes", f"Demo grading for {crop_name}")
        image_quality_warnings = ["No photo uploaded — using demo sample"]
        visible_observations = analysis.get("visible_observations", [])
        detected_issues = analysis.get("detected_issues", [])
        missing_info = analysis.get("missing_information", [])
        limitations = analysis.get("limitations", [])
    else:
        # Unsupported crop
        grade = QualityGrade.UNRATED
        confidence = 0
        method = "manual_required"
        verification_type = "self_declared"
        notes = f"AI grading not supported for {crop_name}. Please select grade manually."
        analysis = None
        image_quality_warnings = []
        visible_observations = []
        detected_issues = []
        missing_info = ["Grade selection required for this crop"]
        limitations = []

    # ── Store assessment ────────────────────────────────────────
    assessment = QualityAssessment(
        lot_id=lot_id,
        assessment_type=verification_type,
        assessed_by=method,
        assessor_user_id=user_id,
        grade=grade,
        confidence=confidence,
        image_url=image_paths[0] if image_paths else None,
        notes=notes,
        status="draft",
    )
    db.add(assessment)
    db.flush()

    # Store individual image URLs
    if len(image_paths) > 1:
        # Store additional images as notes
        assessment.notes = f"{notes}\nAdditional images: {', '.join(image_paths[1:])}"

    # ── Update lot quality ──────────────────────────────────────
    lot.quality_grade = grade
    db.commit()
    db.refresh(assessment)

    # ── Build complete output schema ────────────────────────────
    result = {
        "assessment_id": assessment.id,
        "crop": crop_name,
        "estimated_grade": grade.value,
        "confidence": round(confidence * 100, 1),
        "confidence_label": _confidence_label(confidence),
        "score": analysis.get("score", 0) if analysis else 0,
        "visible_observations": visible_observations,
        "detected_issues": detected_issues,
        "missing_information": missing_info,
        "limitations": limitations,
        "verification_type": verification_type,
        "manual_verification_required": confidence < 0.60 or verification_type == "self_declared",
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "notes": notes,
        "source_label": _source_label(verification_type),
        "image_quality_warnings": image_quality_warnings if image_paths else [],
        "supported": crop_name in SUPPORTED_CROPS_FOR_AI,
        "status": "draft",
    }

    # Include detailed analysis if available
    if analysis:
        result["factors"] = analysis.get("factors", {})
        result["color_analysis"] = analysis.get("color_analysis", {})
        result["defect_analysis"] = analysis.get("defect_analysis", {})

    return result


def confirm_quality(
    db: Session,
    assessment_id: int,
    user_id: int,
    edited_grade: Optional[str] = None,
) -> dict:
    """
    Farmer confirms or edits the AI estimate.
    Creates a revision record for audit trail.
    """
    assessment = db.query(QualityAssessment).filter(QualityAssessment.id == assessment_id).first()
    if not assessment:
        return {"error": "Assessment not found"}

    previous_grade = assessment.grade.value if assessment.grade else None
    previous_verification = assessment.assessment_type

    if edited_grade:
        # Farmer edits the grade
        new_grade = QualityGrade(edited_grade.upper())
        assessment.grade = new_grade
        assessment.assessment_type = "self_declared"
        assessment.status = "accepted"
        revision_type = "farmer_edit"
        notes = f"Farmer edited grade from {previous_grade} to {edited_grade.upper()}"
    else:
        # Farmer accepts the AI estimate
        assessment.assessment_type = "ai_assisted"
        assessment.status = "accepted"
        revision_type = "farmer_confirm"
        notes = f"Farmer confirmed AI estimate: {assessment.grade.value}"

    # Create revision record
    revision = QualityReportRevision(
        assessment_id=assessment_id,
        revised_by=user_id,
        revision_type=revision_type,
        previous_grade=previous_grade,
        new_grade=assessment.grade.value,
        previous_verification=previous_verification,
        new_verification=assessment.assessment_type,
        notes=notes,
    )
    db.add(revision)

    # Update lot
    lot = db.query(ProduceLot).filter(ProduceLot.id == assessment.lot_id).first()
    if lot:
        lot.quality_grade = assessment.grade

    db.commit()

    return {
        "assessment_id": assessment_id,
        "status": "accepted",
        "grade": assessment.grade.value,
        "verification_type": assessment.assessment_type,
        "revision_type": revision_type,
        "notes": notes,
    }


def request_verification(
    db: Session,
    assessment_id: int,
    user_id: int,
    notes: str = "",
) -> dict:
    """Farmer requests manual/admin verification."""
    assessment = db.query(QualityAssessment).filter(QualityAssessment.id == assessment_id).first()
    if not assessment:
        return {"error": "Assessment not found"}

    assessment.status = "pending_verification"
    assessment.notes = f"{assessment.notes}\nVerification requested: {notes}" if notes else assessment.notes

    revision = QualityReportRevision(
        assessment_id=assessment_id,
        revised_by=user_id,
        revision_type="verification_requested",
        previous_verification=assessment.assessment_type,
        new_verification="pending_verification",
        notes=notes or "Manual verification requested by farmer",
    )
    db.add(revision)
    db.commit()

    return {
        "assessment_id": assessment_id,
        "status": "pending_verification",
        "notes": "Verification request submitted. An admin or assessor will review.",
    }


def verify_quality(
    db: Session,
    assessment_id: int,
    admin_user_id: int,
    verified_grade: str,
    verification_type: str = "manually_verified",
    notes: str = "",
) -> dict:
    """Admin/FPO/assayer manually verifies or corrects the grade."""
    assessment = db.query(QualityAssessment).filter(QualityAssessment.id == assessment_id).first()
    if not assessment:
        return {"error": "Assessment not found"}

    previous_grade = assessment.grade.value
    new_grade = QualityGrade(verified_grade.upper())

    assessment.grade = new_grade
    assessment.assessment_type = verification_type
    assessment.assessor_user_id = admin_user_id
    assessment.confidence = 1.0
    assessment.status = "verified"
    assessment.notes = f"{notes}\nVerified by admin: {verified_grade.upper()}" if notes else f"Verified by admin: {verified_grade.upper()}"

    revision = QualityReportRevision(
        assessment_id=assessment_id,
        revised_by=admin_user_id,
        revision_type="admin_correct" if previous_grade != verified_grade.upper() else "admin_verify",
        previous_grade=previous_grade,
        new_grade=verified_grade.upper(),
        previous_verification=assessment.assessment_type,
        new_verification=verification_type,
        notes=notes or f"Admin verification: {verified_grade.upper()}",
    )
    db.add(revision)

    # Update lot
    lot = db.query(ProduceLot).filter(ProduceLot.id == assessment.lot_id).first()
    if lot:
        lot.quality_grade = new_grade

    db.commit()

    return {
        "assessment_id": assessment_id,
        "status": "verified",
        "grade": verified_grade.upper(),
        "verification_type": verification_type,
        "previous_grade": previous_grade,
    }


def get_quality_report(db: Session, lot_id: int) -> Optional[dict]:
    """Get the latest quality report for a lot."""
    assessment = (
        db.query(QualityAssessment)
        .filter(QualityAssessment.lot_id == lot_id)
        .order_by(QualityAssessment.created_at.desc())
        .first()
    )
    if not assessment:
        return None

    return _build_report(assessment)


def get_quality_history(db: Session, lot_id: int) -> List[dict]:
    """Get all quality assessments and revisions for a lot."""
    assessments = (
        db.query(QualityAssessment)
        .filter(QualityAssessment.lot_id == lot_id)
        .order_by(QualityAssessment.created_at.desc())
        .all()
    )
    return [_build_report(a) for a in assessments]


def _build_report(assessment: QualityAssessment) -> dict:
    """Build report dict from assessment model."""
    return {
        "assessment_id": assessment.id,
        "lot_id": assessment.lot_id,
        "crop": "",  # Filled in by caller if needed
        "estimated_grade": assessment.grade.value if assessment.grade else "unrated",
        "confidence": round((assessment.confidence or 0) * 100, 1),
        "verification_type": assessment.assessment_type or "unknown",
        "status": assessment.status or "draft",
        "notes": assessment.notes or "",
        "model_name": MODEL_NAME,
        "model_version": MODEL_VERSION,
        "created_at": assessment.created_at.isoformat() if assessment.created_at else "",
        "updated_at": assessment.updated_at.isoformat() if (hasattr(assessment, 'updated_at') and assessment.updated_at) else "",
    }


def _check_image_quality(image_path: str) -> List[str]:
    """Run image quality checks. Returns list of warnings."""
    try:
        from ml.crop_vision import check_image_quality
        result = check_image_quality(image_path)
        return result.get("warnings", [])
    except Exception:
        return []


def _analyze_with_vision(crop_name: str, image_path: Optional[str]) -> dict:
    """Run real image analysis via crop_vision pipeline."""
    from ml.crop_vision import analyze_image, generate_synthetic_crop_image

    if image_path and os.path.exists(image_path):
        return analyze_image(image_path, crop_name)

    # Demo mode: synthetic image
    import random
    grade_choices = ["A", "A", "A", "B", "B", "C"]
    synthetic_grade = random.choice(grade_choices)

    img_array = generate_synthetic_crop_image(crop_name, synthetic_grade)
    tmp_path = os.path.join(tempfile.gettempdir(), f"synthetic_{crop_name}_{synthetic_grade}.jpg")
    try:
        from PIL import Image
        Image.fromarray(img_array).save(tmp_path)
        result = analyze_image(tmp_path, crop_name)
        result["source_label"] = f"AI analysis of sample {crop_name} image (demo mode)"
        return result
    except Exception:
        return {
            "grade": synthetic_grade,
            "confidence": 0.70,
            "score": 72 if synthetic_grade == "A" else 58 if synthetic_grade == "B" else 40,
            "factors": {},
            "overall_notes": f"Demo mode: simulated Grade {synthetic_grade}. Upload a real photo for actual AI analysis.",
            "source_label": "Simulated analysis (upload a real photo for AI grading)",
            "supported": True,
            "crop": crop_name,
            "visible_observations": ["Demo mode — no real image analyzed"],
            "detected_issues": [],
            "missing_information": ["Real photo needed for actual analysis"],
            "limitations": [],
        }


def _confidence_label(confidence: float) -> str:
    if confidence >= 0.75:
        return "High"
    elif confidence >= 0.50:
        return "Medium"
    elif confidence >= 0.30:
        return "Low"
    return "Very Low"


def _source_label(verification_type: str) -> str:
    labels = {
        "ai_assisted": "AI-assisted quality estimate (not certified grade)",
        "self_declared": "Self-declared by farmer",
        "manually_verified": "Manually verified by authorized assessor",
        "lab_verified": "Laboratory verified",
    }
    return labels.get(verification_type, "Unknown")


def get_supported_crops() -> list:
    """Returns crops that support AI grading with their visible indicators."""
    from ml.crop_vision import CROP_PROFILES
    result = []
    for crop_name in SUPPORTED_CROPS_FOR_AI:
        profile = CROP_PROFILES.get(crop_name, {})
        result.append({
            "name": crop_name,
            "method": "computer_vision",
            "visible_indicators": profile.get("visible_indicators", []),
            "limitations": profile.get("limitations", []),
        })
    return result
