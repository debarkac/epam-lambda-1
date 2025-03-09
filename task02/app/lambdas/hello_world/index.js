const routes = {
    "/hello": {
        GET: () => ({
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                statusCode: 200,
                message: "Hello from Lambda" }),
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
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                statusCode: 400,
                message: `Bad request syntax or unsupported method. Request path: ${path}. HTTP method: ${method}`,
            }),
        };
};