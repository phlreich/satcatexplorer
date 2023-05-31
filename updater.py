# get data from https://celestrak.org/pub/satcat.csv and write to data folder as satcat.csv

import requests

def update():
    url = 'https://celestrak.org/pub/satcat.csv'
    r = requests.get(url, allow_redirects=True)
    open('public/data/satcat.csv', 'wb').write(r.content)
    print('satcat.csv updated')

    # the same for https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv

    url = 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=csv'
    r = requests.get(url, allow_redirects=True)
    open('public/data/active.csv', 'wb').write(r.content)
    print('active.csv updated')

if __name__ == '__main__':
    update()