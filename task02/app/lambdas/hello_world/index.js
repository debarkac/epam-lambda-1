const routes = {
    "/hello": {
        GET: () => ({
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: "Hello from Lambda" }),
        }),
    },
};

exports.handler = async (event) => {
    const path = event.rawPath || "/";
    const method = event.requestContext?.http?.method || "UNKNOWN";

    const routeHandler = routes[path]?.[method];

    return routeHandler
        ? routeHandler()
        : {
            statusCode: 400,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
            }),
        };
};