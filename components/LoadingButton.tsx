type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  loading: boolean;
  loadingText?: string;
};

export default function LoadingButton({ loading, loadingText = "등록 중...", children, ...props }: Props) {
  return (
    <button {...props} disabled={loading || props.disabled}>
      {loading ? loadingText : children}
    </button>
  );
}
