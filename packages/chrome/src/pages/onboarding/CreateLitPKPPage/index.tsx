import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { RootState } from '../../../store';
import { browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { setUnAuthenticated } from '../../../store/pkp-context';

import Login from '../../../components/Login/indext';

const CreatePKP = () => {
  const dispatch = useDispatch();
  const pkpContext = useSelector((state: RootState) => state.pkpContext);
  const [isWebAuthnSupported, setIsWebAuthnSupported] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (pkpContext.isAuthenticated) {
      navigate('/home');
    }
  });

  useEffect(() => {
    const supported =
      browserSupportsWebAuthn() && !navigator.userAgent.includes('Firefox');
    setIsWebAuthnSupported(supported);
  }, []);

  useEffect(() => {
    // Check if session sigs have expired
    async function checkSession() {
      const sessionDate = new Date(pkpContext.sessionExpiration!);
      const now = new Date();
      if (sessionDate < now) {
        // Reset state
        // PKPStore.setUnauthenticated();
        dispatch(setUnAuthenticated());
      }
    }

    // Check session expiration if exists
    if (pkpContext.sessionExpiration) {
      checkSession();
    }
  }, [pkpContext.sessionExpiration]);

  if (!isWebAuthnSupported) {
    return (
      !pkpContext.isAuthenticated && (
        <>
          <div className="webAuthnNotSupported m-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-10 w-10 text-red-500"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            <h1 className="mb-4 mt-6 text-3xl font-medium">
              Browser not supported
            </h1>
            <p className="mb-6">
              Unfortunately, your browser does not support platform
              authenticators. Try visiting this demo on Chrome, Safari, Brave,
              or Edge.
            </p>
            <p>
              Refer to{' '}
              <a
                href="https://webauthn.me/browser-support"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                this table
              </a>{' '}
              for a more comprehensive list of supported browsers and operating
              systems.
            </p>
          </div>
        </>
      )
    );
  }

  return (
    !pkpContext.isAuthenticated && (
      <>
        <Login />
      </>
    )
  );
};

export default CreatePKP;
