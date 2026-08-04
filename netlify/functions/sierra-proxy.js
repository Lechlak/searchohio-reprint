exports.handler = async function(event, context) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  try {
    const payload = JSON.parse(event.body);

    // 1. Get Token
    const tokenResponse = await fetch("https://catalog.toledolibrary.org/iii/sierra-api/v6/token", {
        method: "POST",
        headers: {
            "Authorization": "Basic N1IyTGJPOUpGREI0ZGlJcFNiMEdWakJ4NDVjdDpMU1FCQTVQd0FnUDd0d3hUUmZra2tKRmJNbUpuOTQ=",
            "Accept": "application/json"
        }
    });

    if (!tokenResponse.ok) {
        throw new Error("Failed to authenticate with Sierra API");
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // 2. Query Items
    const queryResponse = await fetch("https://catalog.toledolibrary.org/iii/sierra-api/v6/items/query?offset=0&limit=50", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${accessToken}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    if (!queryResponse.ok) {
        throw new Error("Failed to execute item query");
    }

    const queryData = await queryResponse.json();

    if (!queryData.entries || queryData.entries.length === 0) {
        return {
            statusCode: 200,
            body: JSON.stringify({ entries: [] })
        };
    }

    // Extract item IDs
    const itemIds = queryData.entries.map(entry => entry.link.split("/items/")[1]).join(",");

    // 3. Fetch Item Details
    const itemsResponse = await fetch(`https://catalog.toledolibrary.org/iii/sierra-api/v6/items?id=${itemIds}&fields=id,barcode,callNumber,status,location`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (!itemsResponse.ok) {
        throw new Error("Failed to fetch item details");
    }

    const itemsData = await itemsResponse.json();

    return {
      statusCode: 200,
      body: JSON.stringify(itemsData)
    };
  } catch (error) {
    console.error("Error in sierra-proxy function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
