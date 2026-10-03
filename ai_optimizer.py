import os
import json
import urllib.request
import urllib.error
import subprocess


API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("ERROR: GEMINI_API_KEY is not available.")
    exit(1)


def get_changed_files():

    try:

        result = subprocess.run(
            ["git", "diff", "--name-only", "HEAD~1", "HEAD"],
            capture_output=True,
            text=True
        )

        files = result.stdout.strip()

        if files:
            return files

        return "No changed files detected."

    except Exception as error:

        print("Could not determine changed files:")
        print(error)

        return "Unable to determine changed files."


changed_files = get_changed_files()

requirements_changed = (
    "requirements.txt" in changed_files
)


prompt = f"""
You are an AI optimization engine operating inside a Jenkins
CI/CD pipeline.

Your task is to decide whether Python dependencies need to be
installed again.

Changed files in the current Git commit:

{changed_files}

requirements.txt changed:
{requirements_changed}

Decision rules:

1. If requirements.txt changed, return RUN_INSTALL.

2. If requirements.txt did not change, return USE_CACHE.

Return ONLY:

RUN_INSTALL

or:

USE_CACHE

Do not provide explanations.
Do not provide markdown.
Do not return any other text.
"""


request_data = {

    "contents": [

        {
            "parts": [

                {
                    "text": prompt
                }

            ]
        }

    ]

}


url = (
    "https://generativelanguage.googleapis.com/"
    "v1beta/models/gemini-2.5-flash:generateContent"
    f"?key={API_KEY}"
)


data = json.dumps(request_data).encode("utf-8")


request = urllib.request.Request(

    url,

    data=data,

    headers={
        "Content-Type": "application/json"
    },

    method="POST"

)


try:

    with urllib.request.urlopen(request) as response:

        response_data = json.loads(
            response.read().decode("utf-8")
        )

        ai_response = (
            response_data["candidates"][0]
            ["content"]["parts"][0]["text"]
            .strip()
        )


        print("")
        print("======================================")
        print("       GEMINI AI OPTIMIZER")
        print("======================================")

        print("Changed files:")
        print(changed_files)

        print("")

        print("requirements.txt changed:")
        print(requirements_changed)

        print("")

        print("Gemini decision:")
        print(ai_response)

        print("======================================")
        print("")


        if "RUN_INSTALL" in ai_response:

            with open(
                "ai_decision.txt",
                "w"
            ) as file:

                file.write("RUN_INSTALL")


        elif "USE_CACHE" in ai_response:

            with open(
                "ai_decision.txt",
                "w"
            ) as file:

                file.write("USE_CACHE")


        else:

            print("ERROR: Invalid Gemini response.")
            exit(1)


except urllib.error.HTTPError as error:

    print("Gemini API error:")
    print(error.read().decode("utf-8"))

    exit(1)


except Exception as error:

    print("Gemini request failed:")
    print(error)

    exit(1)
