import { AuthSig } from '@lit-protocol/types';
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface PKPState {
  isAuthenticated: boolean;
  currentUsername?: string;
  currentPKP?: PKP;
  // sessionSigs: SessionSigsMap;
  sessionExpiration?: string;
  authSig?: AuthSig;
}

interface PKP {
  tokenId: string;
  publicKey: string;
  ethAddress: string;
}

const initialState: PKPState = {
  isAuthenticated: false,
  currentUsername: undefined,
  currentPKP: undefined,
  sessionExpiration: undefined,
  authSig: undefined,
};

interface PKPAuth {
  username: string;
  pkp: PKP;
  sessionExpiration: string;
  authsig: AuthSig;
}

export const pkpContextSlice = createSlice({
  name: 'pkpContext',
  initialState,
  reducers: {
    setPKP(state, action: PayloadAction<PKP>) {
      state.currentPKP = action.payload;
    },
    setAuthenticated(state, action: PayloadAction<PKPAuth>) {
      state.isAuthenticated = true;
      state.currentUsername = action.payload.username;
      state.sessionExpiration = action.payload.sessionExpiration;
      state.authSig = action.payload.authsig;
    },
    setUnAuthenticated(state) {
      state.isAuthenticated = false;
      state.currentUsername = undefined;
      state.currentPKP = undefined;
      state.sessionExpiration = undefined;
      state.authSig = undefined;
    },
  },
});

export const { setPKP, setAuthenticated, setUnAuthenticated } =
  pkpContextSlice.actions;

export default pkpContextSlice.reducer;
