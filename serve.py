from seatbelt import seatbelt

from twisted.web.server import Site
from twisted.internet import reactor

import os


def serve(dbpath, port=8001, installSignalHandlers=0):
    pbelt = seatbelt.PirateBelt(dbpath,
                                os.path.join(os.path.dirname(__file__),
                                             'www', 'landing'),
                                os.path.join(os.path.dirname(__file__),
                                             'www', 'chat'))

    site = Site(pbelt)
    reactor.listenTCP(port, site, interface='0.0.0.0')
    reactor.run(installSignalHandlers=installSignalHandlers)

if __name__=='__main__':
    import sys

    serve(sys.argv[1], installSignalHandlers=1)
