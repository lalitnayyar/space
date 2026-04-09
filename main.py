import asyncio
from dotenv import load_dotenv
from claude_agent_sdk import query, ClaudeAgentOptions

load_dotenv(override=True)

PROMPT = """
Make a vanilla HTML + JS + CSS website for a game of Space Invaders.Write the code to files in the current diroctory, including an index.html, style.css, and script.js. The website should have a simple design and include basic functionality for playing Space Invaders. The game should be playable in a web browser and include features such as moving the player's ship, shooting at the invaders, and keeping score. Use your creativity to make the game fun and engaging!
"""
TOOLS = ["Read", "Write","Edit", "Bash","Glob","Grep","AskUserQuestion"]
    
async def main():
    options = ClaudeAgentOptions(allowed_tools=TOOLS, model="claude-opus-4-6")
    async for message in query(prompt=PROMPT, options=options):
        print(message)
        
asyncio.run(main())