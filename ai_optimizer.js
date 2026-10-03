const https = require("https");
const fs = require("fs");

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
    console.error("GEMINI_API_KEY is not available.");
    process.exit(1);
}

function getChangedFiles() {
    try {
        const output = require("child_process")
            .execSync("git diff --name-only HEAD~1 HEAD")
            .toString()
            .trim();

        return output || "No changed files detected";
    } catch (error) {
        return "Unable to determine changed files";
    }
}

const changedFiles = getChangedFiles();

const packageJsonChanged =
    changedFiles.includes("package.json");

const packageLockChanged =
    changedFiles.includes("package-lock.json");

const prompt = `
You are an AI optimization engine inside a Jenkins CI/CD pipeline.

Your job is ONLY to decide whether npm dependencies need to be
installed again.

Project information:

Changed files:
${changedFiles}

package.json changed:
${packageJsonChanged}

package-lock.json changed:
${packageLockChanged}

Rules:

1. If package.json OR package-lock.json changed:
   return RUN_INSTALL

2. If neither dependency file changed:
   return USE_CACHE

Return EXACTLY this format:

DECISION: RUN_INSTALL

or

DECISION: USE_CACHE

Do not provide explanations.
Do not provide markdown.
`;

const data = JSON.stringify({
    contents: [
        {
            parts: [
                {
                    text: prompt
                }
            ]
        }
    ]
});

const options = {
    hostname: "generativelanguage.googleapis.com",
    path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data)
    }
};

const request = https.request(options, response => {

    let body = "";

    response.on("data", chunk => {
        body += chunk;
    });

    response.on("end", () => {

        try {

            const result = JSON.parse(body);

            const text =
                result.candidates?.[0]?.content?.parts?.[0]?.text || "";

            console.log("===== GEMINI AI OPTIMIZER =====");
            console.log(text.trim());
            console.log("================================");

            if (text.includes("RUN_INSTALL")) {
                fs.writeFileSync("ai_decision.txt", "RUN_INSTALL");
            }
            else if (text.includes("USE_CACHE")) {
                fs.writeFileSync("ai_decision.txt", "USE_CACHE");
            }
            else {
                console.error("Invalid Gemini response.");
                process.exit(1);
            }

        } catch (error) {

            console.error("Gemini response parsing failed.");
            console.error(body);

            process.exit(1);
        }
    });

});

request.on("error", error => {
    console.error("Gemini API request failed.");
    console.error(error);
    process.exit(1);
});

request.write(data);
request.end();
