# NTP (OTP) Ticket Management

NTP (N-Time Password) instances are used to issue and manage ticket codes that gate access to content objects. Class 4 NTP instances are managed directly via KMS — no authority service required.

## Prerequisites

Set the `PRIVATE_KEY` environment variable to the tenant admin private key, if we need to create or update otp instance:

```bash
export PRIVATE_KEY=<your-private-key>
```

All commands use the network configured in `src/Config.js`.

---

## Commands

### `otp create`

Create a new NTP instance.

```bash
elv-live otp create <tenant> <object> [options]
```

| Argument | Description |
|---|---|
| `tenant` | Tenant ID (`iten...`) |
| `object` | Permissions object ID (`iq__...`) |

| Option | Default | Description |
|---|---|---|
| `--ntp_class` | `4` | NTP class |
| `--max_tickets` | `10` | Max tickets to issue (0 = unlimited) |
| `--max_redemptions` | `100` | Max redemptions per ticket |
| `--start_time` | | Start time (ISO format, e.g. `2024-01-01`) |
| `--end_time` | | End time (ISO format, e.g. `2100-01-01`) |
| `--ticket_length` | `6` | Number of characters in each ticket code |

```bash
elv-live otp create iten4TXq2en3qtu3JREnE5tSLRf9zLod iq__2G8JtbyLVUQvG73LWWDMWgBDXvTs \
  --start_time 2024-01-01 --end_time 2025-01-01 --max_redemptions 10
```

---

### `otp update`

Update parameters of an existing NTP instance. Only specified fields are changed.

```bash
elv-live otp update <tenant> <otp> [options]
```

| Argument | Description |
|---|---|
| `tenant` | Tenant ID |
| `otp` | NTP instance ID (e.g. `QOTPGzYBjyWFMYa`) |

| Option | Default | Description |
|---|---|---|
| `--max_tickets` | `10` | Max tickets to issue (0 = unlimited) |
| `--max_redemptions` | `100` | Max redemptions per ticket |
| `--start_time` | | New start time (ISO format) |
| `--end_time` | | New end time (ISO format) |

```bash
elv-live otp update iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa \
  --start_time 2024-06-01 --end_time 2024-12-31
```

---

### `otp suspend`

Suspend an NTP instance. All tickets issued for this instance will be treated as expired. To reactivate, use `otp update` with a new end time.

```bash
elv-live otp suspend <tenant> <otp>
```

```bash
elv-live otp suspend iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa
```

---

### `otp delete`

Permanently delete an NTP instance. **This cannot be undone.**

```bash
elv-live otp delete <tenant> <otp>
```

```bash
elv-live otp delete iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa
```

---

### `otp list`

List all NTP instances for a tenant.

```bash
elv-live otp list <tenant> [options]
```

| Option | Default | Description |
|---|---|---|
| `--count` | `10` | Number of results to return |
| `--offset` | `0` | Offset for pagination |

```bash
elv-live otp list iten4TXq2en3qtu3JREnE5tSLRf9zLod --count 20
```

#### Example:
```
./elv-live otp list iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom       
ntpInstances:
  - ntpId: QOTP2K9xojWG2Zx
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__4MaXpmFFgCoG75VLPVHnAisgTrp
    updatedAt: 0
    startTime: 1601946001000
    endTime: 1602485940000
    ticketLength: '6'
    maxRedemptions: '7'
    maxTickets: 1000
    issuedTickets: 90
  - ntpId: QOTP2sCqVb31buv
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__3eJ4QHB7R8wmmvhp4Hz7eqRZfzg
    updatedAt: 0
    startTime: 1602273600000
    endTime: 1609487940000
    ticketLength: '6'
    maxRedemptions: '100000'
    maxTickets: 1000
    issuedTickets: 3
  - ntpId: QOTP3QP3puChe8G
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__454mxb1MjZU2GWFkVMkSR4YgGra6
    updatedAt: 0
    startTime: 1602273600000
    endTime: 1641023940000
    ticketLength: '6'
    maxRedemptions: '1000'
    maxTickets: 1000
    issuedTickets: 1
  - ntpId: QOTP3myT9dkiiST
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__4SqYHMwjjNUv1K4whpcrPzBVqKZP
    updatedAt: 0
    startTime: 1598497200000
    endTime: 1598597940000
    ticketLength: '6'
    maxRedemptions: '3'
    maxTickets: 1000
    issuedTickets: 7
  - ntpId: QOTP3yu7LZHJgsu
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__4SqYHMwjjNUv1K4whpcrPzBVqKZP
    updatedAt: 0
    startTime: 1598497200000
    endTime: 1598702340000
    ticketLength: '6'
    maxRedemptions: '4'
    maxTickets: 1000
    issuedTickets: 0
  - ntpId: QOTP4UvXxj8ocet
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__454mxb1MjZU2GWFkVMkSR4YgGra6
    updatedAt: 0
    startTime: 1604088000000
    endTime: 1604275140000
    ticketLength: '6'
    maxRedemptions: '1000'
    maxTickets: 1000
    issuedTickets: 1626
  - ntpId: QOTP4rfpQCEhXoE
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__454mxb1MjZU2GWFkVMkSR4YgGra6
    updatedAt: 0
    startTime: 1602273600000
    endTime: 1604275140000
    ticketLength: '6'
    maxRedemptions: '1000'
    maxTickets: 1000
    issuedTickets: 1
  - ntpId: QOTP5zvPup5LiwF
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__27jxWVjbos5zLtwmeZ4HcZbpQomL
    updatedAt: 0
    startTime: 1604189515990
    endTime: 1911769915990
    ticketLength: '6'
    maxRedemptions: '100'
    maxTickets: 1000000
    issuedTickets: 67871
  - ntpId: QOTP7MH2BDmFHrf
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__4MaXpmFFgCoG75VLPVHnAisgTrp
    updatedAt: 0
    startTime: 1602100800000
    endTime: 1602273600000
    ticketLength: '6'
    maxRedemptions: '7'
    maxTickets: 1000
    issuedTickets: 4
  - ntpId: QOTP8aG3dy5MV6a
    ntpClass: Class 4
    tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
    kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
    objectId: iq__uAKM3LPNbu1ddPS2iGQniD1NkAd
    updatedAt: 0
    startTime: 1598497200000
    endTime: 1599375540000
    ticketLength: '6'
    maxRedemptions: '20'
    maxTickets: 1000
    issuedTickets: 3
start: 0
end: 10
total: 133
```

---

### `otp show`

Show details of a specific NTP instance.

```bash
elv-live otp show <tenant> <otp>
```

```bash
elv-live otp show iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa
```

#### Example

```
./elv-live otp show iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom QOTPZzj1mf8gZrY

ntpId: QOTPZzj1mf8gZrY
ntpClass: Class 4
tenantId: iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom
kmsId: ikms42f2YMiWdwmPB8Ts34vKm24Su9LJ
objectId: iq__L6dxd2wKUdTfZK67zFMD51eqGXZ
updatedAt: 1774994299303
startTime: .nan
endTime: .nan
ticketLength: '6'
maxRedemptions: '4'
maxTickets: 0
issuedTickets: 1060

```

---

### `otp report`

Show a usage report for a specific NTP instance, including issued and redeemed ticket counts.

```bash
elv-live otp report <tenant> <otp>
```

```bash
elv-live otp report iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa
```

#### Example

```
./elv-live otp report iten2aYr2mCUKsJ6zL9e5kAXZ2mvDXom QOTPZzj1mf8gZrY

Ret: '{"CntIssued":1060,"CntRedeemed":2,"TotalRedemptions":8}'

```

---

### `otp status`

Check the status of a specific ticket code without redeeming it. Useful for verifying whether a code is valid or has hit its redemption limit.

```bash
elv-live otp status <tenant> <otp> <code> [options]
```

| Argument | Description |
|---|---|
| `tenant` | Tenant ID |
| `otp` | NTP instance ID |
| `code` | Ticket code to check |

| Option | Description |
|---|---|
| `--email` | Email bound to this ticket (required if the ticket was issued with an email) |

```bash
elv-live otp status iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa ABC123 \
  --email viewer@example.com
```

> **Note:** A 403 response with `redemptions exceed configured maximum` means the code has been fully used up, not that the code is invalid.

---

### `otp issue_code`

Issue a single ticket code from an NTP instance.

```bash
elv-live otp issue_code <tenant> <otp> [options]
```

| Option | Description |
|---|---|
| `--email` | Email address to bind to this ticket |
| `--max_redemptions` | Override the instance's max redemptions for this ticket |

```bash
elv-live otp issue_code iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa \
  --email viewer@example.com
```

---

### `otp issue_signed_code`

Issue a ticket code signed by the current user's key. The signature is appended to the token.

```bash
elv-live otp issue_signed_code <tenant> <otp> [options]
```

| Option | Description |
|---|---|
| `--email` | Email address to bind to this ticket |
| `--max_redemptions` | Override the instance's max redemptions for this ticket |

```bash
elv-live otp issue_signed_code iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa \
  --email viewer@example.com
```

---

### `otp redeem_code`

Redeem a ticket code to authorize the client for the target content object.

```bash
elv-live otp redeem_code <tenant> <otp> <code> [options]
```

| Argument | Description |
|---|---|
| `tenant` | Tenant ID |
| `otp` | NTP instance ID |
| `code` | The ticket code to redeem |

| Option | Default | Description |
|---|---|---|
| `--email` | | Email bound to this ticket (required if ticket was issued with an email) |
| `--include_ntp_id` | `false` | Return both the object ID and NTP ID in the response |

```bash
elv-live otp redeem_code iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa ABC123 \
  --email viewer@example.com
```

---

### `otp generate_codes`

Generate multiple ticket codes in bulk. Provide either `--quantity` for anonymous codes or `--emails` to bind each code to an email address.

```bash
elv-live otp generate_codes <tenant> <otp> [options]
```

| Option | Description |
|---|---|
| `--quantity` | Number of anonymous codes to generate |
| `--emails` | Path to a file with one email address per line |

```bash
# Generate 10 anonymous codes
elv-live otp generate_codes iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa --quantity 10

# Generate email-bound codes from a file
elv-live otp generate_codes iten4TXq2en3qtu3JREnE5tSLRf9zLod QOTPGzYBjyWFMYa --emails viewers.txt
```

Output is a JSON array of code objects. Redirect to a file to use with `otp make_embed_urls`:

```bash
elv-live otp generate_codes ... > codes.json
```

---

### `otp make_embed_urls`

Generate embed URLs for a playable object, one per code. Each URL embeds the ticket code so viewers can access the content directly via the link.

```bash
elv-live otp make_embed_urls <tenant> <otp> <object> <codes_file>
```

| Argument | Description |
|---|---|
| `tenant` | Tenant ID |
| `otp` | NTP instance ID |
| `object` | Playable object ID (live stream or on-demand, `iq__...`) |
| `codes_file` | Path to JSON file of codes (output of `otp generate_codes`) |

```bash
elv-live otp make_embed_urls \
  iten4TXq2en3qtu3JREnE5tSLRf9zLod \
  QOTPGzYBjyWFMYa \
  iq__2dZdRdqPNQqd7TRuAMNVcTUQ9Mah \
  codes.json
```

---

## Typical Workflow

```bash
# 1. Create an NTP instance
elv-live otp create iten... iq__... --start_time 2024-01-01 --end_time 2025-01-01

# 2. Generate codes (output saved to codes.json)
elv-live otp generate_codes iten... QOTP... --quantity 50 > codes.json

# 3. Generate embed URLs for each code
elv-live otp make_embed_urls iten... QOTP... iq__<playable-object> codes.json

# 4. (Optional) Update the NTP instance dates
elv-live otp update iten... QOTP... --end_time 2025-06-01

# 5. (Optional) Suspend or delete when done
elv-live otp suspend iten... QOTP...
elv-live otp delete iten... QOTP...
```
