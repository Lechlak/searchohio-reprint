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
            "Authorization": process.env.SIERRA_API_TOKEN || "Basic N1IyTGJPOUpGREI0ZGlJcFNiMEdWakJ4NDVjdDpMU1FCQTVQd0FnUDd0d3hUUmZra2tKRmJNbUpuOTQ=",
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
    const itemsResponse = await fetch(`https://catalog.toledolibrary.org/iii/sierra-api/v6/items?id=${itemIds}&fields=id,barcode,callNumber,status,location,bibIds`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`
        }
    });

    if (!itemsResponse.ok) {
        throw new Error("Failed to fetch item details");
    }

    const itemsData = await itemsResponse.json();

    // 4. Fetch Bibliographic Details
    const bibIds = [...new Set(itemsData.entries.flatMap(i => i.bibIds || []))];
    let bibsMap = {};
    
    if (bibIds.length > 0) {
        const bibResponse = await fetch(`https://catalog.toledolibrary.org/iii/sierra-api/v6/bibs?id=${bibIds.join(",")}&fields=id,title,author`, {
            headers: {
                "Authorization": `Bearer ${accessToken}`
            }
        });
        
        if (bibResponse.ok) {
            const bibData = await bibResponse.json();
            if (bibData.entries) {
                bibData.entries.forEach(bib => {
                    bibsMap[bib.id] = bib;
                });
            }
        }
    }

    // Combine item data with bib data and add date requested
    const dateRequested = new Date().toLocaleString();
    
    const enrichedEntries = itemsData.entries.map(item => {
        const bibId = item.bibIds && item.bibIds.length > 0 ? item.bibIds[0] : null;
        const bib = bibId ? bibsMap[bibId] : null;
        
        return {
            ...item,
            title: bib ? bib.title : null,
            author: bib ? bib.author : null,
            recordNumber: bibId,
            dateRequested: dateRequested
        };
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ entries: enrichedEntries })
    };
  } catch (error) {
    console.error("Error in sierra-proxy function:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
