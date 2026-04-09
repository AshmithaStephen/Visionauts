import json 
import urllib.request, urllib.error 
import sys 
body=json.dumps({'prompt':'test backend','model':'gemini-1.5-flash'}).encode('utf-8') 
req=urllib.request.Request('http://127.0.0.1:8000/api/v1/analyze', data=body, headers={'Content-Type':'application/json'}) 
try: 
    resp=urllib.request.urlopen(req, timeout=10) 
    print(resp.status) 
    print(resp.read().decode()) 
except urllib.error.HTTPError as e: 
    print('HTTP', e.code) 
    print(e.read().decode()) 
    sys.exit(1) 
