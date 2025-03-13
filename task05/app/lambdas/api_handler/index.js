import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const dynamoDBClient = new DynamoDBClient();
const TABLE_NAME = process.env.TABLE_NAME || "Events";

export const handler = async (event) => {
  console.log("Received event:", JSON.stringify(event, null, 2));
  
  const inputEvent = parseInput(event);
  if (!inputEvent) {
    return createResponse(400, { message: "Invalid JSON format in request body" });
  }
  
  if (!validateFields(inputEvent)) {
    return createResponse(400, { message: "Invalid input: principalId and content are required" });
  }
  
  try {
    const eventItem = createEventItem(inputEvent);
    console.log("Saving to DynamoDB:", JSON.stringify(eventItem, null, 2));
    
    const response = await saveToDatabase(eventItem);
    console.log("Saved successfully");
    console.log("DynamoDB Response:", response);
    
    const responseObject = createResponse(201, { statusCode: 201, event: eventItem });
    console.log("Final response:", JSON.stringify(responseObject, null, 2));
    return responseObject;
  } catch (error) {
    console.error("Error processing request:", error);
    return createResponse(500, { message: "Internal server error", error: error.message });
  }
};

function parseInput(event) {
  try {
    return typeof event.body === "string" ? JSON.parse(event.body) : event.body;
  } catch (parseError) {
    console.error("Error parsing event body:", parseError);
    return null;
  }
}

function validateFields(inputEvent) {
  return inputEvent?.principalId !== undefined && inputEvent?.content !== undefined;
}

function createEventItem(inputEvent) {
  return {
    id: uuidv4(),
    principalId: Number(inputEvent.principalId),
    createdAt: new Date().toISOString(),
    body: inputEvent.content
  };
}

async function saveToDatabase(item) {
  return await dynamoDBClient.send(new PutCommand({
    TableName: TABLE_NAME,
    Item: item,
  }));
}

function createResponse(statusCode, body) {
  return {
    statusCode,
    body: JSON.stringify(body)
  };
}