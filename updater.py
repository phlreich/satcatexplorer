# get data from https://celestrak.org/pub/satcat.csv and write to data folder as satcat.csv

import requests
import os

def update():
    url = 'https://celestrak.org/pub/satcat.csv'
    r = requests.get(url, allow_redirects=True)
    open('public/satcat.csv', 'wb').write(r.content)
    print('satcat.csv updated')

if __name__ == '__main__':
    update()