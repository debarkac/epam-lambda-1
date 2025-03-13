exports.handler = async (event) => {
    console.log('SNS event received:', JSON.stringify(event));
    
    for (const record of event.Records) {
      console.log('SNS Message:', record.Sns.Message);
    }
    
    return {
      statusCode: 200,
      body: 'Messages processed successfully'
    };
  };