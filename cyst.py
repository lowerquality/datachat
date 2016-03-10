import mimetypes
import os

from twisted.web.static import File
from twisted.web.resource import Resource
from twisted.web.server import Site, NOT_DONE_YET
from twisted.internet import reactor

class Insist(Resource):
    isLeaf = True

    def __init__(self, cacheloc):
        self.cacheloc = cacheloc
        self.cachefile = None
        if os.path.exists(cacheloc):
            self.cachefile = File(cacheloc)
        self.reqs_waiting = []
        self.started = False
        Resource.__init__(self)

    def _check_cache(self):
        # return True if exists, False otherwise

        dirpath = os.path.dirname(self.cacheloc)
        if not os.path.exists(dirpath):
            os.makedirs(dirpath)
        
        # Check if someone else has created the file somehow
        if os.path.exists(self.cacheloc):
           if self.cachefile is None:
               self.cachefile = File(self.cacheloc)
        else:
            if self.cachefile is not None:
                self.cachefile = None
                # The file was deleted while the program was running
                self.started = False

        return self.cachefile is not None

    def render_GET(self, req):
        if self._check_cache():
            return self.cachefile.render_GET(req)
        else:
            self.reqs_waiting.append(req)
            req.notifyFinish().addErrback(
                self._nevermind, req)
            if not self.started:
                self.started = True
                reactor.callInThread(self.desist)
            return NOT_DONE_YET

    def _nevermind(self, _err, req):
        self.reqs_waiting.remove(req)

    def sync_get(self):
        # returns the completed path
        if not self._check_cache():
            self.desist()
        return self.cacheloc

    def desist(self):
        self.serialize_computation(self.cacheloc)
        reactor.callFromThread(self.resist)

    def _get_mime(self):
        return mimetypes.guess_type(self.cacheloc)[0]

    def resist(self):
        if not os.path.exists(self.cacheloc):
            # Error!
            print "%s does not exist - rendering fail!" % (self.cacheloc)
            for req in self.reqs_waiting:
                req.headers["Content-Type"] = "text/plain"
                req.write("cyst error")
                req.finish()
            return

        self.cachefile = File(self.cacheloc)

        # Send content to all interested parties
        for req in self.reqs_waiting:
            self.cachefile.render(req)
        self.reqs_waiting = []

    def serialize_computation(self, outpath):
        raise NotImplemented

class HelloCyst(Insist):
    def serialize_computation(self, outpath):
        import time
        time.sleep(10)
        open(outpath, "w").write("Hello, World")

if __name__=='__main__':
    import sys
    c = HelloCyst(sys.argv[1])
    site = Site(c)
    port = 7984
    reactor.listenTCP(port, site)
    print "http://localhost:%d" % (port)
    reactor.run()
