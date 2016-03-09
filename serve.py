from seatbelt import seatbelt

from twisted.web.server import Site
from twisted.internet import reactor
from twisted.web import proxy

import sys

kiwixport = 8080
kiwixroot = ""

pbelt = seatbelt.PirateBelt(sys.argv[1], 'www/landing', 'www/chat')
pbelt.putChild("_wp", proxy.ReverseProxyResource("localhost", kiwixport, kiwixroot))
site = Site(pbelt)
reactor.listenTCP(8001, site, interface='0.0.0.0')
reactor.run()
    
