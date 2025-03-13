import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const dynamoDBClient = new DynamoDBClient();
const TABLE_NAME = process.env.TABLE_NAME || "Events";

const parseEventBody = (event) => {
    if (typeof event.body === "string") {
        try {
            return JSON.parse(event.body);
        } catch (error) {
            throw new Error("Invalid JSON format in request body");
        }
    }
    return event.body;
};

const validateInput = (inputEvent) => {
    if (!inputEvent?.principalId || inputEvent?.content === undefined) {
        throw new Error("Invalid input: principalId and content are required");
    }
};

const createEventItem = (inputEvent) => ({
    id: uuidv4(),
    principalId: Number(inputEvent.principalId),
    createdAt: new Date().toISOString(),
    body: inputEvent.content
});

const saveToDynamoDB = async (eventItem) => {
    await dynamoDBClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: eventItem,
    }));
};

export const handler = async (event) => {
    console.log("Received event:", JSON.stringify(event, null, 2));

    try {
        const inputEvent = parseEventBody(event);
        validateInput(inputEvent);
        const eventItem = createEventItem(inputEvent);
        await saveToDynamoDB(eventItem);

        const response = {
            statusCode: 201,
            body: JSON.stringify({ statusCode: 201, event: eventItem })
        };

        console.log("Final response:", JSON.stringify(response, null, 2));
        return response;
    } catch (error) {
        console.error("Error processing request:", error);
        return {
            statusCode: error.message.includes("Invalid") ? 400 : 500,
            body: JSON.stringify({ message: error.message })
        };
    }
};
