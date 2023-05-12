# get data from https://www.space-track.org/basicspacedata/query/class/boxscore and write as json file into /data if last update is older than 1 day

import requests
import json
import os
import time

# check if data is already up to date by checking the last modified date of the file

if os.path.isfile('data/boxscore.json') and os.path.getmtime('data/boxscore.json') > time.time() - 86400:

    print('data is already up to date')

else:
    session = requests.Session()
    session.post('https://www.space-track.org/ajaxauth/login', data={'identity': 'philip.a.reich@gmail.com', 'password': 'N4Dcr*UDYdV8vce'})
    response = session.get('https://www.space-track.org/basicspacedata/query/class/boxscore')
    with open('data/boxscore.json', 'w') as outfile:
        json.dump(response.json(), outfile)