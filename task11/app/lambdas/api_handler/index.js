import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Environment configuration
const CONFIG = {
  USER_POOL_ID: process.env.cup_id,
  CLIENT_ID: process.env.cup_client_id,
  TABLES_TABLE: process.env.tables_table,
  RESERVATIONS_TABLE: process.env.reservations_table,
  REGION: process.env.AWS_REGION || 'eu-west-1'
};

// AWS service clients
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

// Response helpers
const createResponse = (statusCode, body) => ({
  statusCode,
  headers: {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(body),
});

// Authentication helper
const authenticate = (event) => {
  const username = event.requestContext?.authorizer?.claims?.['cognito:username'];
  if (!username) {
    return null;
  }
  return username;
};

// Route handlers
const routeHandlers = {
  // Authentication routes
  async signUp(event) {
    try {
      const { firstName, lastName, email, password } = JSON.parse(event.body);
      
      if (!firstName || !lastName || !email || !password) {
        return createResponse(400, { error: "All fields are required." });
      }
      
      // Set AWS region
      AWS.config.update({ region: CONFIG.REGION });
      
      // Create user in Cognito
      await cognito.adminCreateUser({
        UserPoolId: CONFIG.USER_POOL_ID,
        Username: email,
        UserAttributes: [
          { Name: "given_name", Value: firstName },
          { Name: "family_name", Value: lastName },
          { Name: "email", Value: email },
          { Name: "email_verified", Value: "true" },
        ],
        TemporaryPassword: password,
        MessageAction: "SUPPRESS",
      }).promise();
      
      // Set permanent password
      await cognito.adminSetUserPassword({
        UserPoolId: CONFIG.USER_POOL_ID,
        Username: email,
        Password: password,
        Permanent: true,
      }).promise();
      
      return createResponse(200, { message: "User created successfully." });
    } catch (error) {
      console.error("Signup Error:", error);
      
      if (error.code === "UsernameExistsException") {
        return createResponse(400, { error: "Email already exists." });
      }
      
      return createResponse(500, { error: "Signup failed. Internal Server Error." });
    }
  },
  
  async signIn(event) {
    try {
      const { email, password } = JSON.parse(event.body);
      
      if (!email || !password) {
        return createResponse(400, { error: "Email and password are required." });
      }
      
      AWS.config.update({ region: CONFIG.REGION });
      
      const authResponse = await cognito.adminInitiateAuth({
        AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
        UserPoolId: CONFIG.USER_POOL_ID,
        ClientId: CONFIG.CLIENT_ID,
        AuthParameters: {
          USERNAME: email,
          PASSWORD: password,
        },
      }).promise();
      
      if (authResponse.AuthenticationResult) {
        return createResponse(200, {
          idToken: authResponse.AuthenticationResult.IdToken,
        });
      } else {
        return createResponse(400, { error: "Authentication failed." });
      }
    } catch (error) {
      console.error("Signin Error:", error);
      return createResponse(500, { error: "Invalid email or password." });
    }
  },
  
  // Table management routes
  async getTables(event) {
    if (!authenticate(event)) {
      return createResponse(401, { message: "Unauthorized" });
    }
    
    try {
      const result = await dynamodb.scan({ 
        TableName: CONFIG.TABLES_TABLE 
      }).promise();
      
      return createResponse(200, { tables: result.Items });
    } catch (error) {
      console.error("Get Tables Error:", error);
      return createResponse(500, { message: "Internal Server Error" });
    }
  },
  
  async createTable(event) {
    if (!authenticate(event)) {
      return createResponse(401, { message: "Unauthorized" });
    }
    
    try {
      const tableData = JSON.parse(event.body);
      const tableId = tableData.id || uuidv4();
      
      await dynamodb.put({
        TableName: CONFIG.TABLES_TABLE,
        Item: { 
          id: tableId,
          ...tableData,
          minOrder: tableData.minOrder ?? 0 
        },
      }).promise();
      
      return createResponse(200, { id: tableId });
    } catch (error) {
      console.error("Create Table Error:", error);
      return createResponse(500, { message: "Internal Server Error" });
    }
  },
  
  async getTableById(event) {
    if (!authenticate(event)) {
      return createResponse(401, { message: "Unauthorized" });
    }
    
    try {
      const tableId = event.pathParameters.tableId;
      const result = await dynamodb.get({
        TableName: CONFIG.TABLES_TABLE,
        Key: { id: tableId },
      }).promise();
      
      if (!result.Item) {
        return createResponse(404, { message: "Table not found" });
      }
      
      return createResponse(200, result.Item);
    } catch (error) {
      console.error("Get Table By Id Error:", error);
      return createResponse(500, { message: "Internal Server Error" });
    }
  },
  
  // Reservation management routes
  async getReservations(event) {
    if (!authenticate(event)) {
      return createResponse(401, { message: "Unauthorized" });
    }
    
    try {
      const result = await dynamodb.scan({ 
        TableName: CONFIG.RESERVATIONS_TABLE 
      }).promise();
      
      return createResponse(200, { reservations: result.Items });
    } catch (error) {
      console.error("Get Reservations Error:", error);
      return createResponse(500, { message: "Internal Server Error" });
    }
  },
  
  async createReservation(event) {
    if (!authenticate(event)) {
      return createResponse(401, { message: "Unauthorized" });
    }
    
    try {
      const reservationData = JSON.parse(event.body);
      
      const reservation = {
        id: uuidv4(),
        tableId: reservationData.tableId,
        clientName: reservationData.clientName,
        phoneNumber: reservationData.phoneNumber,
        date: reservationData.date,
        time: reservationData.slotTimeStart,
        slotTimeEnd: reservationData.slotTimeEnd,
        createdAt: new Date().toISOString(),
      };
      
      await dynamodb.put({
        TableName: CONFIG.RESERVATIONS_TABLE,
        Item: reservation
      }).promise();
      
      return createResponse(200, { 
        reservationId: reservation.id,
        message: "Reservation created successfully" 
      });
    } catch (error) {
      console.error("Create Reservation Error:", error);
      return createResponse(500, { message: "Internal Server Error" });
    }
  }
};

// Route mapping
const routeMap = {
  "POST /signup": routeHandlers.signUp,
  "POST /signin": routeHandlers.signIn,
  "GET /tables": routeHandlers.getTables,
  "POST /tables": routeHandlers.createTable,
  "GET /tables/{tableId}": routeHandlers.getTableById,
  "GET /reservations": routeHandlers.getReservations,
  "POST /reservations": routeHandlers.createReservation,
};

// Main handler
export const handler = async (event) => {
  console.log("Event Received:", JSON.stringify(event));
  
  const routeKey = `${event.httpMethod} ${event.resource}`;
  const routeHandler = routeMap[routeKey];
  
  if (routeHandler) {
    return await routeHandler(event);
  } else {
    return createResponse(404, { message: "Not Found" });
  }
};