import asyncio
from mcp_client_test import get_all_tools , tavily_mcp_search

if __name__ == "__main__":
    query = "latest news about AI"
    asyncio.run(tavily_mcp_search(query))