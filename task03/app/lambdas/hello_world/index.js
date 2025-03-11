exports.handler = async (event) => {
    let response;

    if (event.resource === "/hello" && event.httpMethod === "GET") {
        response = {
            "statusCode": 200,
            "body": JSON.stringify({
                "statusCode": 200,
                "message": "Hello from Lambda"
            }),
            "headers": {
                "content-type": "application/json"
            },
            "isBase64Encoded": false
        };
    }

    return response;
};