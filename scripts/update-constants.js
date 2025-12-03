const fs = require("fs");
const path = require("path");
const hre = require("hardhat");

async function main() {
    console.log("Compiling contracts...");
    await hre.run("compile");

    const artifactPath = path.join(__dirname, "../artifacts/contracts/InvoiceRegistry.sol/InvoiceRegistry.json");
    if (!fs.existsSync(artifactPath)) {
        console.error("Artifact not found at:", artifactPath);
        process.exit(1);
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abi = artifact.abi;
    const bytecode = artifact.bytecode;

    console.log("Updating constants.ts...");
    const constantsPath = path.join(__dirname, "../constants.ts");
    let constantsContent = fs.readFileSync(constantsPath, "utf8");

    // Regex to replace ABI
    const abiRegex = /export const INVOICE_REGISTRY_ABI = \[\s*([\s\S]*?)\];/;
    const newAbiString = `export const INVOICE_REGISTRY_ABI = ${JSON.stringify(abi, null, 2)};`;

    // Regex to replace Bytecode
    const bytecodeRegex = /export const INVOICE_REGISTRY_BYTECODE = "0x[a-fA-F0-9]*";/;
    const newBytecodeString = `export const INVOICE_REGISTRY_BYTECODE = "${bytecode}";`;

    // Update ABI
    // Note: The original file has ABI as array of strings (Human Readable), but Hardhat gives JSON ABI.
    // Ethers v6 supports JSON ABI directly.
    // However, to keep it clean, we might want to just replace the whole variable definition.

    // Let's try to replace the whole block.
    // If the regex doesn't match perfectly due to formatting, we might need a more robust approach or just overwrite.
    // Given I know the file structure, I'll try to replace the variable declarations.

    // Replace ABI
    // We need to be careful not to break the file if regex fails.
    if (constantsContent.match(abiRegex)) {
        constantsContent = constantsContent.replace(abiRegex, newAbiString);
    } else {
        console.warn("Could not find INVOICE_REGISTRY_ABI to replace. Appending...");
        // This might be risky, better to warn user.
    }

    // Replace Bytecode
    if (constantsContent.match(bytecodeRegex)) {
        constantsContent = constantsContent.replace(bytecodeRegex, newBytecodeString);
    } else {
        console.warn("Could not find INVOICE_REGISTRY_BYTECODE to replace.");
    }

    fs.writeFileSync(constantsPath, constantsContent);
    console.log("constants.ts updated successfully!");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
