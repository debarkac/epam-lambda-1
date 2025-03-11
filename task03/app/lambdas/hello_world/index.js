exports.handler = async (event) => {
    // TODO implement
    const response = {
        "statusCode": 200,
        "message": "Hello from Lambda",
        headers: { "Content-Type": "application/json" },
    };
    return response;
};
