# Lit-Suiet, The seedless SUI Wallet

> **Warning**
> Lit protocol is in a developer preview state. The data on the Serrano Testnet is not persistent and may be erased at any time.
> Do not store anything of value

## Demo Video

---

<br>
<center>
<a href="http://www.youtube.com/watch?feature=player_embedded&v=IhUsXxZzumE" target="_blank">
 <img src="https://img.youtube.com/vi/IhUsXxZzumE/maxresdefault.jpg" alt="Watch the video" width="720" height="405" />
</a>
</center>
<br>

## About Lit-Suiet

---

Lit Suiet is a seedless wallet built on Sui blockChain with Lit protocol PKP(Programmable Key Pairs).  
With Lit Protocol PKP User’s can Login or SignUp with Google.  
Lit Protocol is a decentralized key management network, it can be used in centralized key custodians and other key management solutions.  
Lit protocol provides Multi-Party Computation (MPC) as a Key Management Solution.  
Currently PKP doesn’t Supports Sui, So We’ve implemented pkp-sui sdk.
It’s based on Secp256k1 and doesn’t have private key even on the code level.  
Since there’s no private key, signData works with lit action. You can find the source code for pkp-sui at https://github.com/yhl125/pkp-sui

## 🚀 Getting Started

### ⚙️ Prepare the enviroment

1. Make sure you have [nodejs](https://nodejs.org/en/download/) install with [npm](https://docs.npmjs.com/)
2. Clone the suiet main repo

```bash
git clone https://github.com/yhl125/lit-suiet.git
```

3. Install the dependencies

```bash
npm install
```

### 🏁 Run app in your browser

Run the following command at the root path of the project

```bash
npm run build
```

Then load the extension dist folder `packages/chrome/dist` in Chrome [#detail](https://developer.chrome.com/docs/extensions/mv3/faq/#:~:text=You%20can%20start%20by%20turning,a%20packaged%20extension%2C%20and%20more.)

And you can use the app in your chrome under development mode.
