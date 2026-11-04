#!/usr/bin/env bash
# Smoke test of role enforcement and the cancel-restores-balance rule against a running API.
# Usage: API=http://localhost:3100 bash scripts/smoke.sh   (run `npm run seed` first)
API=${API:-http://localhost:3000}
PW='Password123!'

login() { curl -s -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$1\",\"password\":\"$PW\"}" | node -pe 'JSON.parse(require("fs").readFileSync(0)).accessToken'; }
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
check() { printf '%-62s expected %s got %s  %s\n' "$1" "$2" "$3" "$([ "$2" = "$3" ] && echo OK || echo FAIL)"; }

EMP=$(login liam@company.test)     # employee on Maria's team
MARIA=$(login maria@company.test)  # manager
JAMES=$(login james@company.test)  # manager of the other team
ADMIN=$(login admin@company.test)
H() { echo "Authorization: Bearer $1"; }

check "wrong password is rejected" 401 "$(code -X POST $API/auth/login -H 'Content-Type: application/json' -d '{"email":"liam@company.test","password":"nope"}')"
check "employee cannot read admin config" 403 "$(code -H "$(H $EMP)" $API/admin/config)"
check "employee cannot approve" 403 "$(code -X PATCH -H "$(H $EMP)" $API/leave-requests/1/approve)"
check "manager cannot create a request" 403 "$(code -X POST -H "$(H $MARIA)" -H 'Content-Type: application/json' $API/leave-requests -d '{}')"
check "admin can read config" 200 "$(code -H "$(H $ADMIN)" $API/admin/config)"

# A pending request belonging to Maria's team: James must not decide it, Maria may.
PENDING=$(curl -s -H "$(H $MARIA)" "$API/leave-requests/team?status=pending" | node -pe 'JSON.parse(require("fs").readFileSync(0))[0].id')
check "other team's manager cannot approve (id $PENDING)" 403 "$(code -X PATCH -H "$(H $JAMES)" $API/leave-requests/$PENDING/approve)"
check "own manager can approve (id $PENDING)" 200 "$(code -X PATCH -H "$(H $MARIA)" $API/leave-requests/$PENDING/approve)"
check "approved request cannot be decided twice" 400 "$(code -X PATCH -H "$(H $MARIA)" $API/leave-requests/$PENDING/approve)"

# Cancel restores the balance.
remaining() { curl -s -H "$(H $EMP)" "$API/leave-requests/balance?year=2026" | node -pe 'JSON.parse(require("fs").readFileSync(0)).find(t=>t.leaveType==="Unpaid").remaining'; }
BEFORE=$(remaining)
NEW=$(curl -s -X POST -H "$(H $EMP)" -H 'Content-Type: application/json' $API/leave-requests \
  -d '{"leaveTypeId":3,"startDate":"2026-12-08","endDate":"2026-12-10","reason":"Smoke test leave"}')
echo "create response: $NEW"
ID=$(echo "$NEW" | node -pe 'JSON.parse(require("fs").readFileSync(0)).id')
AFTER=$(remaining)
check "balance drops by 3 after requesting 3 days" "$((BEFORE-3))" "$AFTER"
check "overlapping request is rejected" 409 "$(code -X POST -H "$(H $EMP)" -H 'Content-Type: application/json' $API/leave-requests -d '{"leaveTypeId":3,"startDate":"2026-12-09","endDate":"2026-12-09","reason":"Overlap attempt"}')"
check "end before start is rejected" 400 "$(code -X POST -H "$(H $EMP)" -H 'Content-Type: application/json' $API/leave-requests -d '{"leaveTypeId":3,"startDate":"2026-12-14","endDate":"2026-12-11","reason":"Bad range"}')"
check "cancel succeeds" 200 "$(code -X PATCH -H "$(H $EMP)" $API/leave-requests/$ID/cancel)"
check "balance is restored after cancel" "$BEFORE" "$(remaining)"

# Changing a configured value changes behaviour with no code change.
check "request with 6 days notice is accepted at minNoticeDays=2" 201 "$(code -X POST -H "$(H $EMP)" -H 'Content-Type: application/json' $API/leave-requests -d '{"leaveTypeId":3,"startDate":"2026-11-10","endDate":"2026-11-10","reason":"Notice test"}')"
curl -s -X PUT -H "$(H $ADMIN)" -H 'Content-Type: application/json' $API/admin/config -d '{"minNoticeDays":30}' > /dev/null
check "same kind of request is rejected once admin sets notice to 30" 400 "$(code -X POST -H "$(H $EMP)" -H 'Content-Type: application/json' $API/leave-requests -d '{"leaveTypeId":3,"startDate":"2026-11-17","endDate":"2026-11-17","reason":"Notice test 2"}')"
curl -s -X PUT -H "$(H $ADMIN)" -H 'Content-Type: application/json' $API/admin/config -d '{"minNoticeDays":2}' > /dev/null
