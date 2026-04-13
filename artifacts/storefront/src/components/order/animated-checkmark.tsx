export function AnimatedCheckmark() {
  return (
    <svg
      className="checkmark-svg"
      viewBox="0 0 52 52"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        className="checkmark-circle"
        cx="26"
        cy="26"
        r="25"
      />
      <path
        className="checkmark-check"
        d="M14.1 27.2l7.1 7.2 16.7-16.8"
      />
    </svg>
  );
}
