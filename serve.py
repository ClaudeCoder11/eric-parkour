#!/usr/bin/env python3
"""
Dev server for the parkour game.

This is the same as `python3 -m http.server`, with one important difference:
it tells the browser NEVER to cache anything. Without that, you edit a .js
file, hit refresh, and the browser quietly runs the OLD version - which looks
exactly like "my change did nothing" and wastes a lot of time.

    python3 serve.py            # then open http://localhost:8100
    python3 serve.py 9000       # use a different port
"""
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):          # quieter output
        if "GET" in (fmt % args) and " 200 " in (fmt % args):
            return
        super().log_message(fmt, *args)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8100
    handler = partial(NoCacheHandler, directory=".")
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    print(f"3D Parkour dev server\n"
          f"  computer : http://localhost:{port}\n"
          f"  tests    : http://localhost:{port}/tests.html\n"
          f"  phone    : http://<your-mac-ip>:{port}   (find it with: ipconfig getifaddr en0)\n"
          f"Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
