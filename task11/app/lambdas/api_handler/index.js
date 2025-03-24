import AWS from 'aws-sdk';
import { v4 as uuidv4 } from 'uuid';

// Initialize AWS services
const dynamodb = new AWS.DynamoDB.DocumentClient();
const cognito = new AWS.CognitoIdentityServiceProvider();

// Get configuration from environment variables
const CONFIG = {
  USER_POOL_ID: process.env.cup_id,
  CLIENT_ID: process.env.cup_client_id,
  TABLES_TABLE: process.env.tables_table,
  RESERVATIONS_TABLE: process.env.reservations_table,
};

export const handler = async (event) => {
  console.log("Event Received:", JSON.stringify(event));

  const routes = {
    "POST /signup": handleSignup,
    "POST /signin": handleSignin,
    "GET /tables": handleGetTables,
    "POST /tables": handleCreateTable,
    "GET /tables/{tableId}": handleGetTableById,
    "GET /reservations": handleGetReservations,
    "POST /reservations": handleCreateReservation,
  };

  const routeKey = `${event.httpMethod} ${event.resource}`;
  return routes[routeKey] ? await routes[routeKey](event) : notFoundResponse();
};

const corsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
  'Content-Type': 'application/json',
});

const formatResponse = (statusCode, body) => ({
  statusCode,
  headers: corsHeaders(),
  body: JSON.stringify(body),
});

const notFoundResponse = () => formatResponse(404, { message: "Not Found" });

async function handleSignup(event) {
  try {
    console.log("Signup Request Received:", event.body);
    const { firstName, lastName, email, password } = JSON.parse(event.body);

    if (!firstName || !lastName || !email || !password) {
      return formatResponse(400, { error: "All fields are required." });
    }

    // Ensure AWS SDK is using the right region
    AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

    const params = {
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
    };

    console.log("Creating Cognito user...");
    await cognito.adminCreateUser(params).promise();

    console.log("Setting permanent password...");
    await cognito.adminSetUserPassword({
      UserPoolId: CONFIG.USER_POOL_ID,
      Username: email,
      Password: password,
      Permanent: true,
    }).promise();

    console.log("User successfully created!");
    return formatResponse(200, { message: "User created successfully." });
  } catch (error) {
    console.error("Signup Error:", error);

    if (error.code === "UsernameExistsException") {
      return formatResponse(400, { error: "Email already exists." });
    }

    return formatResponse(500, { error: "Signup failed. Internal Server Error." });
  }
}

async function handleSignin(event) {
  try {
    console.log("Signin Request Received:", event.body);
    const { email, password } = JSON.parse(event.body);

    if (!email || !password) {
      return formatResponse(400, { error: "Email and password are required." });
    }

    AWS.config.update({ region: process.env.AWS_REGION || 'us-east-1' });

    const params = {
      AuthFlow: "ADMIN_USER_PASSWORD_AUTH",
      UserPoolId: CONFIG.USER_POOL_ID,
      ClientId: CONFIG.CLIENT_ID,
      AuthParameters: {
        USERNAME: email,
        PASSWORD: password,
      },
    };

    console.log("Authenticating user...");
    const authResponse = await cognito.adminInitiateAuth(params).promise();

    if (authResponse.AuthenticationResult) {
      console.log("Authentication successful!");
      return formatResponse(200, {
        idToken: authResponse.AuthenticationResult.IdToken,
      });
    } else {
      console.log("Authentication failed.");
      return formatResponse(400, { error: "Authentication failed." });
    }
  } catch (error) {
    console.error("Signin Error:", error);
    return formatResponse(500, { error: "Invalid email or password." });
  }
}

async function handleGetTables(event) {
  if (!getUsernameFromToken(event)) return formatResponse(401, { message: "Unauthorized" });

  try {
    const result = await dynamodb.scan({ TableName: CONFIG.TABLES_TABLE }).promise();
    return formatResponse(200, { tables: result.Items });
  } catch (error) {
    return formatResponse(400, { message: "Internal Server Error" });
  }
}

async function handleCreateTable(event) {
  if (!getUsernameFromToken(event)) return formatResponse(401, { message: "Unauthorized" });
  const table = JSON.parse(event.body);

  const params = {
    TableName: CONFIG.TABLES_TABLE,
    Item: { id: table.id || uuidv4(), ...table, minOrder: table.minOrder ?? 0 },
  };
  await dynamodb.put(params).promise();
  return formatResponse(200, { id: params.Item.id });
}

async function handleGetTableById(event) {
  if (!getUsernameFromToken(event)) return formatResponse(401, { message: "Unauthorized" });
  
  const params = {
    TableName: CONFIG.TABLES_TABLE,
    Key: { id: event.pathParameters.tableId },
  };
  try {
    const result = await dynamodb.get(params).promise();
    return result.Item ? formatResponse(200, result.Item) : formatResponse(404, { message: "Table not found" });
  } catch (error) {
    return formatResponse(400, { message: "Internal Server Error" });
  }
}

async function handleGetReservations(event) {
  if (!getUsernameFromToken(event)) return formatResponse(401, { message: "Unauthorized" });
  const params = { TableName: CONFIG.RESERVATIONS_TABLE };
  const result = await dynamodb.scan(params).promise();
  return formatResponse(200, { reservations: result.Items });
}

async function handleCreateReservation(event) {
  if (!getUsernameFromToken(event)) return formatResponse(401, { message: "Unauthorized" });
  const body = JSON.parse(event.body);

  const reservation = {
    id: uuidv4(),
    tableId: body.tableId,
    clientName: body.clientName,
    phoneNumber: body.phoneNumber,
    date: body.date,
    time: body.slotTimeStart,
    slotTimeEnd: body.slotTimeEnd,
    createdAt: new Date().toISOString(),
  };
  await dynamodb.put({ TableName: CONFIG.RESERVATIONS_TABLE, Item: reservation }).promise();
  return formatResponse(200, { reservationId: reservation.id, message: "Reservation created successfully" });
}

function getUsernameFromToken(event) {
  return event.requestContext?.authorizer?.claims?.['cognito:username'] || null;
}
