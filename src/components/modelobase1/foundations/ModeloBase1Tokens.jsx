import "./modelo-base1-tokens.css";
import "./modelo-base1-reset.css";
import "../modelo-base1-components.css";

export default function ModeloBase1Tokens({ children, className = "", enterpriseScope = true }) {
  return (
    <div className={`mb1-scope ${enterpriseScope ? "cadastro-emp-scope mg-empresas-scope" : ""} ${className}`.trim()}>
      {children}
    </div>
  );
}
