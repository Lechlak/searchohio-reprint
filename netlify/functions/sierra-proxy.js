const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const path = event.path.replace('/.netlify/functions/sierra-proxy', '').replace('/api', '');
    const url = `https://catalog.toledolibrary.org/iii/sierra-api/v6${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;

    const headers = { ...event.headers };
    
    // Remove headers that might cause issues when proxying
    delete headers.host;
    delete headers['content-length'];
    delete headers['accept-encoding'];
    
    // Check if we are requesting the token endpoint. If so, inject the secret server-side.
    if (path === '/token' && event.httpMethod === 'POST') {
        const token = process.env.SIERRA_API_TOKEN 
        headers['authorization'] = token;
    }

    try {
        const response = await fetch(url, {
            method: event.httpMethod,
            headers: headers,
            body: event.body ? event.body : undefined
        });

        const data = await response.text();
        
        return {
            statusCode: response.status,
            headers: {
                'Content-Type': response.headers.get('content-type') || 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: data
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization, Accept',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};
