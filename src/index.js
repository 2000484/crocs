import { createServer } from "node:http";
import { fileURLToPath } from "url";
import { hostname } from "node:os";
import { server as wisp, logging } from "@mercuryworkshop/wisp-js/server";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";

import { scramjetPath } from "@mercuryworkshop/scramjet/path";
import { libcurlPath } from "@mercuryworkshop/libcurl-transport";
import { baremuxPath } from "@mercuryworkshop/bare-mux/node";

const publicPath = fileURLToPath(new URL("../public/", import.meta.url));

// Wisp Configuration: Refer to the documentation at https://www.npmjs.com/package/@mercuryworkshop/wisp-js

// Enable verbose logging to debug connection issues
logging.set_level(logging.INFO);
Object.assign(wisp.options, {
	allow_udp_streams: false,
	// Don't blacklist any hosts - allow all connections
	hostname_blacklist: [],
	// Use multiple DNS servers for better connectivity
	dns_servers: ["8.8.8.8", "8.8.4.4", "1.1.1.1", "1.0.0.1"],
	// Disable certificate pinning for development
	tls_verify: false,
});

// Get the host for Scramjet configuration
const getHost = (req) => `${req.protocol || "http"}://${req.hostname || req.headers.host}`;

const fastify = Fastify({
	serverFactory: (handler) => {
		return createServer()
			.on("request", (req, res) => {
				res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
				res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
				handler(req, res);
			})
			.on("upgrade", (req, socket, head) => {
				const path = (req.url || "").split("?")[0];
				if (path.startsWith("/wisp/")) wisp.routeRequest(req, socket, head);
				else if (path.startsWith("/wsproxy/")) wisp.routeRequest(req, socket, head);
				else socket.end();
			});
	},
});

fastify.addHook("onRequest", (request, reply, done) => {
	reply.header("X-Content-Type-Options", "nosniff");
	reply.header("Referrer-Policy", "no-referrer");
	reply.header("X-Frame-Options", "SAMEORIGIN");
	reply.header("X-XSS-Protection", "1; mode=block");
	reply.header(
		"Strict-Transport-Security",
		"max-age=31536000; includeSubDomains"
	);
	reply.header(
		"Permissions-Policy",
		"camera=(), microphone=(), geolocation=(), payment=()"
	);
	done();
});

fastify.register(fastifyStatic, {
	root: publicPath,
	decorateReply: true,
	maxAge: "1h",
});

fastify.register(fastifyStatic, {
	root: scramjetPath,
	prefix: "/scram/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.register(fastifyStatic, {
	root: libcurlPath,
	prefix: "/libcurl/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.register(fastifyStatic, {
	root: baremuxPath,
	prefix: "/baremux/",
	decorateReply: false,
	maxAge: "7d",
	immutable: true,
});

fastify.setNotFoundHandler((res, reply) => {
	return reply.code(404).type("text/html").sendFile("404.html");
});

fastify.server.on("listening", () => {
	const address = fastify.server.address();

	// by default we are listening on 0.0.0.0 (every interface)
	// we just need to list a few
	console.log("Listening on:");
	console.log(`\thttp://localhost:${address.port}`);
	console.log(`\thttp://${hostname()}:${address.port}`);
	console.log(
		`\thttp://${
			address.family === "IPv6" ? `[${address.address}]` : address.address
		}:${address.port}`
	);
});

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function shutdown() {
	console.log("SIGTERM signal received: closing HTTP server");
	fastify.close();
	process.exit(0);
}

let port = parseInt(process.env.PORT || "");

if (isNaN(port)) port = 8080;

fastify.listen({
	port: port,
	host: "0.0.0.0",
});
