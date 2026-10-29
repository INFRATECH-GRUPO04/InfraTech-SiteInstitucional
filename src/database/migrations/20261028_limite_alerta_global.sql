-- Execute uma vez em bancos InfraTech já existentes para habilitar limites globais por empresa.
CREATE TABLE IF NOT EXISTS limite_alerta_global (
    id_limite_global INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    tipo ENUM('cpu', 'ram', 'disco', 'rede') NOT NULL,
    limite_atencao DECIMAL(5,2) NOT NULL,
    limite_critico DECIMAL(5,2) NOT NULL,
    UNIQUE KEY uq_limite_global_empresa_tipo (fk_empresa, tipo),
    CONSTRAINT fk_limite_global_empresa FOREIGN KEY (fk_empresa) REFERENCES empresa(id_empresa)
);
