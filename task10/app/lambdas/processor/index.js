const AWS = require("aws-sdk");
const axios = require("axios");
const { v4: uuidv4 } = require("uuid");
const AWSXRay = require("aws-xray-sdk");

AWSXRay.captureAWS(AWS);

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const TABLE_NAME = process.env.WEATHER_TABLE || "Weather";
const WEATHER_API_URL = "https://api.open-meteo.com/v1/forecast?latitude=50.4375&longitude=30.5&hourly=temperature_2m&timezone=auto";

exports.handler = async (event) => {
  console.log("Fetching weather data...");

  try {
    const { data } = await axios.get(WEATHER_API_URL);
    const weatherRecord = formatWeatherData(data);

    console.log("Saving to DynamoDB:", weatherRecord);
    await saveToDynamoDB(weatherRecord);

    console.log("Weather data saved successfully!");
    return buildResponse(200, { message: "Weather data stored", data: weatherRecord });
  } catch (error) {
    console.error("Error fetching/storing weather data:", error);
    return buildResponse(500, { error: "Failed to fetch/store weather data" });
  }
};

const formatWeatherData = (weatherData) => ({
  id: uuidv4(),
  forecast: {
    elevation: weatherData.elevation,
    generationtime_ms: weatherData.generationtime_ms,
    hourly: weatherData.hourly,
    hourly_units: weatherData.hourly_units,
    latitude: weatherData.latitude,
    longitude: weatherData.longitude,
    timezone: weatherData.timezone,
    timezone_abbreviation: weatherData.timezone_abbreviation,
    utc_offset_seconds: weatherData.utc_offset_seconds,
  },
});

const saveToDynamoDB = async (weatherRecord) => {
  return dynamoDB.put({ TableName: TABLE_NAME, Item: weatherRecord }).promise();
};

const buildResponse = (statusCode, body) => ({
  statusCode,
  body: JSON.stringify(body),
});
