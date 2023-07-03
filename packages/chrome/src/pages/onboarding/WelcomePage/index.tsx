import RectButton from './RectButton';
import { useNavigate } from 'react-router-dom';
import BrandLayout from '../../../layouts/BrandLayout';
import { useEffectAdjustInitializedStatus } from '../../../hooks/useEffectAdjustInitializedStatus';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import Button from '../../../components/Button';

const Welcome = () => {
  const navigate = useNavigate();
  const appContext = useSelector((state: RootState) => state.appContext);

  function handleCreateNewWallet() {
    navigate('/onboard/create-new-wallet');
  }
  function handleImportWallet() {
    navigate('/onboard/import-wallet');
  }

  function handleCreatePKP() {
    // navigate('/onboard/create-new-pkp-wallet-google');
    chrome.tabs.create({
      url: chrome.runtime.getURL(
        'index.html#/onboard/create-new-pkp-wallet-google'
      ),
    });
  }

  useEffectAdjustInitializedStatus(appContext);

  if (appContext.initialized) {
    setTimeout(() => {
      navigate('/');
    }, 0);
    return null;
  }
  return (
    <BrandLayout
      grayTitle={'Welcome to'}
      blackTitle={'Suiet'}
      desc={'The wallet for everyone.'}
    >
      <section className={'mt-[67px] w-full flex justify-between'}>
        <RectButton theme={'primary'} onClick={handleCreateNewWallet}>
          Create New
        </RectButton>
        <RectButton onClick={handleImportWallet}>Import Wallet</RectButton>
      </section>
      <section className="mt-[17px] w-full">
        <button
          onClick={handleCreatePKP}
          className="flex w-full justify-between px-5 py-2 border-4	 flex gap-2 border-slate-200 rounded-lg text-slate-700 hover:border-slate-400 hover:text-slate-900 hover:shadow transition duration-150"
        >
          <img
            className="w-6 h-6"
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            loading="lazy"
            alt="google logo"
          />
          <span>Login Or Sign Up With Google</span>
        </button>
      </section>
    </BrandLayout>
  );
};

export default Welcome;
