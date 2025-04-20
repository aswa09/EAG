import os
from dotenv import load_dotenv
from mcp import ClientSession, StdioServerParameters, types
from mcp.client.stdio import stdio_client
import asyncio
from google import genai
from concurrent.futures import TimeoutError
from functools import partial

# Load environment variables from .env file
load_dotenv()

# Access your API key and initialize Gemini client correctly
api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key)

max_iterations = 10
last_response = None
iteration = 0
iteration_response = []

async def generate_with_timeout(client, prompt, timeout=10):
    """Generate content with a timeout"""
    logging.info("Starting LLM generation...")
    try:
        # Convert the synchronous generate_content call to run in a thread
        loop = asyncio.get_event_loop()
        response = await asyncio.wait_for(
            loop.run_in_executor(
                None, 
                lambda: client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=prompt
                )
            ),
            timeout=timeout
        )
        logging.info("LLM generation completed")
        return response
    except TimeoutError:
        logging.info("LLM generation timed out!")
        raise
    except Exception as e:
        logging.info(f"Error in LLM generation: {e}")
        raise

def reset_state():
    """Reset all global variables to their initial state"""
    global last_response, iteration, iteration_response
    last_response = None
    iteration = 0
    iteration_response = []

async def main():
    reset_state()  # Reset at the start of main
    logging.info("Starting main execution...")
    try:
        # Create a single MCP server connection
        logging.info("Establishing connection to MCP server...")
        server_params = StdioServerParameters(
            command="python",
            args=["example2.py"]
        )

        async with stdio_client(server_params) as (read, write):
            logging.info("Connection established, creating session...")
            async with ClientSession(read, write) as session:
                logging.info("Session created, initializing...")
                await session.initialize()
                
                # Get available tools
                logging.info("Requesting tool list...")
                tools_result = await session.list_tools()
                tools = tools_result.tools
                logging.info(f"Successfully retrieved {len(tools)} tools")

                # Create system prompt with available tools
                logging.info("Creating system prompt...")
                logging.info(f"Number of tools: {len(tools)}")
                
                try:
                    # First, let's inspect what a tool object looks like
                    # if tools:
                    #     logging.info(f"First tool properties: {dir(tools[0])}")
                    #     logging.info(f"First tool example: {tools[0]}")
                    
                    tools_description = []
                    for i, tool in enumerate(tools):
                        try:
                            # Get tool properties
                            params = tool.inputSchema
                            desc = getattr(tool, 'description', 'No description available')
                            name = getattr(tool, 'name', f'tool_{i}')
                            
                            # Format the input schema in a more readable way
                            if 'properties' in params:
                                param_details = []
                                for param_name, param_info in params['properties'].items():
                                    param_type = param_info.get('type', 'unknown')
                                    param_details.append(f"{param_name}: {param_type}")
                                params_str = ', '.join(param_details)
                            else:
                                params_str = 'no parameters'

                            tool_desc = f"{i+1}. {name}({params_str}) - {desc}"
                            tools_description.append(tool_desc)
                            logging.info(f"Added description for tool: {tool_desc}")
                        except Exception as e:
                            logging.info(f"Error processing tool {i}: {e}")
                            tools_description.append(f"{i+1}. Error processing tool")
                    
                    tools_description = "\n".join(tools_description)
                    logging.info("Successfully created tools description")
                except Exception as e:
                    logging.info(f"Error creating tools description: {e}")
                    tools_description = "Error loading tools"
                
                logging.info("Created system prompt...")              
                system_prompt = f"""You are a math agent solving problems in iterations. You have access to various mathematical and MS Paint tools.

Available tools:
{tools_description}

You must respond with EXACTLY ONE line in one of these formats (no additional text):
1. For function calls:
   FUNCTION_CALL: function_name|param1|param2|...
   
2. For final Mathematical answers:
   FINAL_ANSWER: [final_function_response]


Important:
- When a function returns multiple values, you need to process all of them
- Once you reach the end of the mathematical steps, proceed to do the following MS paint tasks:
    1. Open MS paint
    2. Draw a rectangle in the middle of it
    3. Take the final Mathematical result, and add it as a text within the rectangle drawn by you.
- Ensure the text box is strictly within the rectangle boundary drawn by you
- Only give FINAL_ANSWER when you have completed all necessary calculations and steps
- Do not repeat function calls with the same parameters

Examples:
- FUNCTION_CALL: add|5|3
- FUNCTION_CALL: strings_to_chars_to_int|INDIA
- FUNCTION_CALL: open_paint
- FUNCTION_CALL: draw_rectangle|450|700|780|500


DO NOT include any explanations or additional text.
Your entire response should be a single line starting with either FUNCTION_CALL: or FINAL_ANSWER:"""
                #- FINAL_ANSWER: [{'content': [TextContent(type='text',text=f"Text:'{text}' added successfully")]}]
                query = """Find the ASCII values of characters in ASWATHI and then return sum of exponentials of those values."""
                logging.info("Starting iteration loop...")
                
                # Use global iteration variables
                global iteration, last_response
                
                while iteration < max_iterations:
                    logging.info(f"\n--- Iteration {iteration + 1} ---")
                    if last_response is None:
                        current_query = query
                    else:
                        current_query = current_query + "\n\n" + " ".join(iteration_response)
                        current_query = current_query + "  What should I do next?"

                    # Get model's response with timeout
                    logging.info("Preparing to generate LLM response...")
                    print(system_prompt)
                    exit(0)
                    prompt = f"{system_prompt}\n\nQuery: {current_query}"
                    try:
                        response = await generate_with_timeout(client, prompt)
                        response_text = response.text.strip()
                        logging.info(f"LLM Response: {response_text}")
                        
                        # Find the FUNCTION_CALL line in the response
                        for line in response_text.split('\n'):
                            line = line.strip()
                            if line.startswith("FUNCTION_CALL:"):
                                response_text = line
                                break
                        
                    except Exception as e:
                        logging.info(f"Failed to get LLM response: {e}")
                        break

                    if not response_text.startswith("FINAL_ANSWER:"):
                        _, function_info = response_text.split(":", 1)
                        parts = [p.strip() for p in function_info.split("|")]
                        func_name, params = parts[0], parts[1:]
                        
                        logging.info(f"\nRaw function info: {function_info}")
                        logging.info(f"Split parts: {parts}")
                        logging.info(f"Function name: {func_name}")
                        logging.info(f"Raw parameters: {params}")
                        
                        try:
                            # Find the matching tool to get its input schema
                            tool = next((t for t in tools if t.name == func_name), None)
                            if not tool:
                                logging.info(f"Available tools: {[t.name for t in tools]}")
                                raise ValueError(f"Unknown tool: {func_name}")

                            logging.info(f"Found tool: {tool.name}")
                            logging.info(f"Tool schema: {tool.inputSchema}")

                            # Prepare arguments according to the tool's input schema
                            arguments = {}
                            schema_properties = tool.inputSchema.get('properties', {})
                            logging.info(f"Schema properties: {schema_properties}")

                            for param_name, param_info in schema_properties.items():
                                if not params:  # Check if we have enough parameters
                                    raise ValueError(f"Not enough parameters provided for {func_name}")
                                    
                                value = params.pop(0)  # Get and remove the first parameter
                                param_type = param_info.get('type', 'string')
                                
                                logging.info(f"Converting parameter {param_name} with value {value} to type {param_type}")
                                
                                # Convert the value to the correct type based on the schema
                                if param_type == 'integer':
                                    arguments[param_name] = int(value)
                                elif param_type == 'number':
                                    arguments[param_name] = float(value)
                                elif param_type == 'array':
                                    # Handle array input
                                    if isinstance(value, str):
                                        value = value.strip('[]').split(',')
                                    arguments[param_name] = [int(x.strip()) for x in value]
                                else:
                                    arguments[param_name] = str(value)

                            logging.info(f"Final arguments: {arguments}")
                            logging.info(f"Calling tool {func_name}")
                            
                            result = await session.call_tool(func_name, arguments=arguments)
                            logging.info(f"Raw result: {result}")
                            
                            # Get the full result content
                            if hasattr(result, 'content'):
                                logging.info(f"Result has content attribute")
                                # Handle multiple content items
                                if isinstance(result.content, list):
                                    iteration_result = [
                                        item.text if hasattr(item, 'text') else str(item)
                                        for item in result.content
                                    ]
                                else:
                                    iteration_result = str(result.content)
                            else:
                                logging.info(f"Result has no content attribute")
                                iteration_result = str(result)
                                
                            logging.info(f"Final iteration result: {iteration_result}")
                            
                            # Format the response based on result type
                            if isinstance(iteration_result, list):
                                result_str = f"[{', '.join(iteration_result)}]"
                            else:
                                result_str = str(iteration_result)
                            
                            iteration_response.append(
                                f"In the {iteration + 1} iteration you called {func_name} with {arguments} parameters, "
                                f"and the function returned {result_str}."
                            )
                            last_response = iteration_result
                            logging.info("\n\n~~ Current iteration response ~~")
                            logging.info(iteration_result)
                            logging.info("\n~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~")
                        except Exception as e:
                            logging.info(f"Error details: {str(e)}")
                            logging.info(f"Error type: {type(e)}")
                            import traceback
                            traceback.print_exc()
                            iteration_response.append(f"Error in iteration {iteration + 1}: {str(e)}")
                            break

                    else:
                        logging.info("\n##### Iterations Finished! #####\n")
                        logging.info("\n=== Agent Execution Complete ===")
                        break

                    iteration += 1

    except Exception as e:
        logging.info(f"Error in main execution: {e}")
        import traceback
        traceback.print_exc()
    finally:
        reset_state()  # Reset at the end of main

if __name__ == "__main__":
    import logging

    logging.basicConfig(
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler("logfile.log", mode='a'),
            logging.StreamHandler()
        ]
    )
    asyncio.run(main())