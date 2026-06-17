const url = "https://klapeabwtphxqdspiggv.supabase.co/rest/v1/";
const key = "sb_publishable_WJgO75r7N5OQ82XBmrvjsA_r3YCPENt";

async function inspect() {
    console.log("Fetching inventario...");
    const invRes = await fetch(url + "inventario?select=*&select=Id%20Referencia&limit=1", {
        headers: { "apikey": key, "Authorization": "Bearer " + key }
    });
    const invData = await invRes.json();
    console.log("Inventario sample:", JSON.stringify(invData, null, 2));

    console.log("\nFetching requerimientos_pedido...");
    const reqRes = await fetch(url + "requerimientos_pedido?select=*&select=Id%20Referencia&limit=1", {
        headers: { "apikey": key, "Authorization": "Bearer " + key }
    });
    const reqData = await reqRes.json();
    console.log("requerimientos_pedido sample:", JSON.stringify(reqData, null, 2));
}

inspect();
