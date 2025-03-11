const routes = {
    "/hello": {
        GET: () => ({
            "statusCode": 200,
            "body": {
              "statusCode": 200,
              "message": "Hello from Lambda"
            },
            "headers": {
              "content-type": "application/json"
            },
            "isBase64Encoded": false
          }),
    },
};

exports.handler = async (event) => {
    const path = event.rawPath || "/";
    const method = event.requestContext?.http?.method || "UNKNOWN";

    const routeHandler = routes[path]?.[method];

    return routeHandler;
};