from SmartApi import SmartConnect
import pyotp

api_key = "4DBv6HvT"
client_code = "N89824"
password = "9691"
totp_secret = "AV7KF7BEJBOOCVIS53TZZB2VEU"

totp = pyotp.TOTP(totp_secret).now()
print(f"Generated TOTP: {totp}")

smartApi = SmartConnect(api_key=api_key)

try:
    data = smartApi.generateSession(client_code, password, totp)
    print("Generate Session Response:", data)
    if data.get('status'):
        print("JWT Token Success!")
        feedToken = smartApi.getfeedToken()
        print("Feed Token:", feedToken)

        # Get LTP for RELIANCE (NSE, token 2885)
        ltp_data = smartApi.ltpData("NSE", "RELIANCE-EQ", "2885")
        print("RELIANCE LTP Data:", ltp_data)
except Exception as e:
    print("SmartApi Exception:", e)
