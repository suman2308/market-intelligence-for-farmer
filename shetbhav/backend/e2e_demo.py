"""E2E Demo Flow Test - 22 steps using correct API field names"""
import json, urllib.request, urllib.error

BASE = 'http://localhost:8000'
results = []

def api(method, path, data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(f'{BASE}{path}', data=body, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read())
        except:
            return e.code, {}

def test(name, status, ok):
    results.append((name, 'PASS' if ok else 'FAIL'))
    mark = '[PASS]' if ok else '[FAIL]'
    print(f'  {mark} [{status}] {name}')

print('=== ShetBhav E2E Demo Flow (22 steps) ===\n')

# 1. Login as Ramesh
s, d = api('POST', '/auth/login', {'username':'ramesh','password':'demo123'})
r_token = d.get('access_token','')
test('1. Farmer login', s, s==200 and bool(r_token))

# 2. Farmer profile
s, d = api('GET', '/farmers/profile', token=r_token)
test('2. Farmer profile', s, s==200 and 'farm_address' in d)

# 3. Farmer dashboard
s, d = api('GET', '/farmers/dashboard', token=r_token)
test('3. Farmer dashboard', s, s==200)

# 4. Market prices
s, d = api('GET', '/markets/prices?crop_id=1', token=r_token)
test('4. Market prices', s, s==200 and isinstance(d, dict) and 'prices' in d)

# 5. Smart Sell (requires lat/lng)
s, d = api('POST', '/smart-sell', {
    'crop_id': 1, 'quantity_kg': 10000, 'grade': 'A',
    'location_lat': 19.9975, 'location_lng': 73.7898,
    'urgency': 'soon'
}, token=r_token)
has_options = 'best_option' in d or 'options' in d or 'recommendation' in d
test('5. Smart Sell recommendation', s, s==200 and has_options)

# 6. Create or reuse lot (idempotent)
s, d = api('GET', '/lots', token=r_token)
existing_lots = [l for l in d if l.get('status') == 'active'] if isinstance(d, list) else []
if existing_lots:
    lot_id = existing_lots[0].get('id')
    test('6. Reuse existing lot', 200, bool(lot_id))
else:
    s, d = api('POST', '/lots', {
        'crop_id': 1, 'quantity_kg': 10000, 'grade': 'A',
        'location': 'Nashik, Maharashtra',
        'expected_price_per_kg': 22.0
    }, token=r_token)
    lot_id = d.get('id') or d.get('lot_id')
    test('6. Create lot', s, s in [200,201] and lot_id)

# 7. List lots
s, d = api('GET', '/lots', token=r_token)
test('7. List lots', s, s==200 and isinstance(d, list))

# 8. Login as buyer
s, d = api('POST', '/auth/login', {'username':'abc_foods','password':'demo123'})
b_token = d.get('access_token','')
test('8. Buyer login', s, s==200 and bool(b_token))

# 9. Buyer profiles
s, d = api('GET', '/buyers', token=b_token)
test('9. Buyer profiles', s, s==200)

# 10. Create demand
s, d = api('POST', '/demand', {
    'crop_id': 1, 'quantity_kg': 5000, 'grade': 'A',
    'location': 'Mumbai',
    'offered_price_per_q': 2400.0
}, token=b_token)
test('10. Create demand', s, s in [200,201])

# 11. List demands
s, d = api('GET', '/demand', token=b_token)
test('11. List demands', s, s==200 and isinstance(d, list))

# 12. Make offer
if lot_id:
    s, d = api('POST', '/offers', {
        'lot_id': lot_id, 'price_per_q': 24000.0,
        'quantity_kg': 10000,
        'message': 'Looking forward to buying'
    }, token=b_token)
    offer_id = d.get('id') or d.get('offer_id')
    test('12. Make offer', s, s in [200,201] and offer_id)
else:
    offer_id = None
    test('12. Make offer', 404, False)

# 13. Farmer lists offers
s, d = api('GET', '/offers', token=r_token)
test('13. Farmer offers', s, s==200 and isinstance(d, list))

# 14. Counter offer
if offer_id:
    s, d = api('POST', f'/offers/{offer_id}/counter', {
        'price_per_q': 25000.0,
        'message': 'Counter at 2500/q'
    }, token=r_token)
    test('14. Counter offer', s, s in [200,201])
    # 15. Buyer accepts
    s, d = api('POST', f'/offers/{offer_id}/accept', token=b_token)
    test('15. Buyer accepts offer', s, s in [200,201])
else:
    test('14. Counter offer', 404, False)
    test('15. Buyer accepts', 404, False)

# 16. Create order from offer
if offer_id:
    s, d = api('POST', f'/orders/from-offer/{offer_id}', token=b_token)
    order_id = d.get('id') or d.get('order_id')
    test('16. Create order', s, s in [200,201] and order_id)
else:
    order_id = None
    test('16. Create order', 404, False)

# 17. Order events
if order_id:
    s, d = api('GET', f'/orders/{order_id}/events', token=r_token)
    test('17. Order events', s, s==200)
else:
    test('17. Order events', 404, False)

# 18. Simulate payment
if order_id:
    s, d = api('POST', f'/payments/{order_id}/simulate', token=b_token)
    test('18. Simulate payment', s, s in [200,201])
else:
    test('18. Simulate payment', 404, False)

# 19. Raise grievance
grievance_data = {
    'category': 'payment_delayed',
    'description': 'Payment delayed by 3 days'
}
if order_id:
    grievance_data['order_id'] = order_id
s, d = api('POST', '/grievances', grievance_data, token=r_token)
grievance_id = d.get('id')
test('19. Raise grievance', s, s in [200,201] and grievance_id)

# 20. Admin login
s, d = api('POST', '/auth/login', {'username':'admin','password':'demo123'})
a_token = d.get('access_token','')
test('20. Admin login', s, s==200 and bool(a_token))

# 21. Admin stats
s, d = api('GET', '/admin/stats', token=a_token)
test('21. Admin stats', s, s==200)

# 22. Admin resolve grievance
if grievance_id:
    s, d = api('PUT', f'/grievances/{grievance_id}/resolve', {
        'status': 'resolved',
        'admin_response': 'Payment released. Sorry for the delay.'
    }, token=a_token)
    test('22. Resolve grievance', s, s in [200,201])
else:
    test('22. Resolve grievance', 404, False)

print()
passed = sum(1 for _,v in results if v=='PASS')
failed = sum(1 for _,v in results if v=='FAIL')
print(f'Results: {passed}/{len(results)} passed, {failed} failed')
if failed > 0:
    print('FAILURES:')
    for name, v in results:
        if v=='FAIL':
            print(f'  {name}')
