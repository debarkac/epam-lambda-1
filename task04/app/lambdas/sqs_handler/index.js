exports.handler = async (event) => {
    console.log('SQS event received:', JSON.stringify(event));
    
    for (const record of event.Records) {
      console.log('SQS Message Body:', record.body);
    }
    
    return {
      statusCode: 200,
      body: 'Messages processed successfully'
    };
  };