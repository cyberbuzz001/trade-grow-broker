p = "/etc/nginx/sites-available/tradegrowx"
with open(p, "r") as f:
    text = f.read()
text = text.replace("return 404; # managed by Certbot", "return 301 https://tradegrowx.in$request_uri;")
with open(p, "w") as f:
    f.write(text)
print("Updated Nginx config successfully")
