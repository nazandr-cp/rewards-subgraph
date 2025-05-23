/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: "0.8.28",
  networks: {
    hardhat: {
      forking: {
        url: "https://apechain-curtis.g.alchemy.com/v2/ARHRws7GPIN5-9uuAui0w0jXgNYNQZmd",
      },
    },
  },
};
