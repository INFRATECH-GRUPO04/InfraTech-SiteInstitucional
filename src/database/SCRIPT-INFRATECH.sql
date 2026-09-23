CREATE DATABASE InfraTech;
USE InfraTech ;

-- -----------------------------------------------------
-- Table `InfraTech`.`endereco`
-- -----------------------------------------------------
CREATE TABLE endereco (
  id_endereco INT PRIMARY KEY AUTO_INCREMENT,
  cep CHAR(8) NOT NULL,
  logradouro VARCHAR(100) NOT NULL,
  bairro VARCHAR(100) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  complemento VARCHAR(100),
  estado CHAR(2) NOT NULL,
  cidade VARCHAR(100) NOT NULL
);


-- -----------------------------------------------------
-- Table `InfraTech`.`empresa`
-- -----------------------------------------------------
CREATE TABLE empresa (
  id_empresa INT PRIMARY KEY AUTO_INCREMENT,
  razao_social VARCHAR(100) NOT NULL,
  nome_fantasia VARCHAR(100),
  cnpj CHAR(14) NOT NULL,
  segmento_atuacao VARCHAR(80),
  email VARCHAR(200) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  status_sistema TINYINT NOT NULL,
  dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fk_endereco INT,
    FOREIGN KEY (fk_endereco) 
    REFERENCES endereco(id_endereco)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`funcionario`
-- -----------------------------------------------------
CREATE TABLE funcionario (
  id_funcionario INT PRIMARY KEY AUTO_INCREMENT,
  fk_empresa INT NOT NULL,
  adm TINYINT DEFAULT 0,
  nome VARCHAR(45) NOT NULL,
  data_nascimento DATETIME NOT NULL,
  email VARCHAR(45) NOT NULL,
  senha VARCHAR(45) NOT NULL,
  cpf CHAR(11) NOT NULL,
  status_sistema TINYINT NOT NULL,
  dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_funcionario_empresa
    FOREIGN KEY (fk_empresa)
    REFERENCES empresa (id_empresa)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor`
-- -----------------------------------------------------
CREATE TABLE servidor (
  id_servidor INT PRIMARY KEY AUTO_INCREMENT,
  fk_empresa INT NOT NULL,
  nome VARCHAR(45) NULL,
  status_sistema TINYINT NOT NULL,
  dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cfkEmpresa 
  FOREIGN KEY (fk_empresa) 
  REFERENCES empresa(id_empresa)
  );




-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_funcionario`
-- -----------------------------------------------------
CREATE TABLE servidor_funcionario (
  fk_funcionario INT NOT NULL,
  fk_servidor INT NOT NULL,
  PRIMARY KEY (fk_funcionario,fk_servidor),
  CONSTRAINT fk_servidor_funcionario_funcionario1
    FOREIGN KEY (fk_funcionario)
    REFERENCES funcionario (id_funcionario),
  CONSTRAINT fk_servidor_funcionario_servidor1
    FOREIGN KEY (fk_servidor)
    REFERENCES servidor (id_servidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`convite`
-- -----------------------------------------------------
CREATE TABLE convite (
  id_convite INT PRIMARY KEY AUTO_INCREMENT NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  tipo_acesso VARCHAR(45) NOT NULL,
  quantidade_uso INT NOT NULL,
  quantidade_usada INT NOT NULL DEFAULT 0,
  criado DATETIME DEFAULT NOW(),
  fk_empresa INT NOT NULL,
  CONSTRAINT fk_convite_empresa
    FOREIGN KEY (fk_empresa)
    REFERENCES empresa (id_empresa));


-- -----------------------------------------------------
-- Table `InfraTech`.`componente`
-- -----------------------------------------------------
CREATE TABLE componente (
    id_componente INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(45) NOT NULL, -- cpu, ram, disco
    modelo VARCHAR(100),
    numero_serie VARCHAR(100), 
    capacidade_total DECIMAL(14,2),
    unidade_capacidade VARCHAR(45),
    status_monitoramento TINYINT,
    entrada_sistema DATETIME,
    fk_servidor_componente INT,
    FOREIGN KEY (fk_servidor_componente) REFERENCES servidor(id_servidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`parametro_monitoramento`
-- -----------------------------------------------------
CREATE TABLE parametro_monitoramento (
  id_parametro_monitoramento INT PRIMARY KEY AUTO_INCREMENT,
  limite_atencao DECIMAL(14,2) NOT NULL,
  limite_critico DECIMAL(14,2) NOT NULL,
	fk_servidor_parametro INT,
    FOREIGN KEY (fk_servidor_parametro) REFERENCES servidor(id_servidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`metrica`
-- -----------------------------------------------------
-- O que será monitorado em relação a qual componente
CREATE TABLE metrica (
    id_metrica INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(100),
    unidade_medida VARCHAR(45),
    descricao VARCHAR(200),
    fk_componente INT,
    fk_parametro_monitoramento INT,
    FOREIGN KEY (fk_componente) REFERENCES componente(id_componente),
    FOREIGN KEY (fk_parametro_monitoramento) REFERENCES parametro_monitoramento(id_parametro_monitoramento)
);


-- =====================================================
-- INSERTS ATUALIZADOS
-- =====================================================

-- 1. Endereço 
INSERT INTO endereco (cep, logradouro, bairro, numero, complemento, estado, cidade) VALUES
('02002000', 'Avenida Paulista', 'Bela Vista', '1500', 'Sala 42', 'SP', 'São Paulo'),
('03003000', 'Rua Augusta', 'Consolação', '500', 'Andar 3', 'SP', 'São Paulo'),
('04004000', 'Rua Funchal', 'Vila Olímpia', '200', 'Conjunto 12', 'SP', 'São Paulo');

-- 2. Empresa
INSERT INTO empresa (razao_social, nome_fantasia, cnpj, segmento_atuacao, email, telefone, status_sistema, fk_endereco) VALUES
('InfraTech Games Ltda', 'InfraTech Games', '12345678000101', 'Desenvolvimento de Jogos', 'contato@infratech.com', '11999990001', 1, 1),
('GameCloud Servicos S.A.', 'GameCloud', '23456789000102', 'Hospedagem e Cloud', 'contato@gamecloud.com', '11999990002', 1, 2),
('TechPlay Tecnologia Ltda', 'TechPlay', '34567890000103', 'Sistemas e Softwares', 'contato@techplay.com', '11999990003', 1, 3);

-- 3. Funcionário 
INSERT INTO funcionario (fk_empresa, adm, nome, data_nascimento, email, senha, cpf, status_sistema) VALUES
(1, 1, 'Felipe Santos', '2007-04-12', 'felipe@infratech.com', '123456', '12345678901', 1),
(1, 0, 'Guilherme Albuquerque', '2007-08-23', 'guilherme@infratech.com', '123456', '23456789012', 1),
(1, 1, 'Manuella Arantes', '2007-01-15', 'manuella@infratech.com', '123456', '34567890123', 1),
(1, 0, 'Luiz Silva', '2006-11-05', 'luiz@infratech.com', '123456', '45678901234', 1),
(1, 0, 'Sarah Sato', '2007-08-25', 'sarah@infratech.com', '123456', '56789012345', 1),
(1, 0, 'Vitor Andrade', '2003-03-18', 'vitor@infratech.com', '123456', '67890123456', 1),
(2, 0, 'Alexandre Oliveira', '1997-06-03', 'alexandre@gamecloud.com', '123456', '28643895271', 1),
(3, 1, 'Luana Pereira', '2003-03-18', 'luana@techplay.com', '123456', '94784210876', 1);

-- 4. Servidor
INSERT INTO servidor (nome, fk_empresa, status_sistema) VALUES
('Servidor Principal', 1, 1),
('Servidor Backup', 1, 1),
('Servidor Game 01', 2, 1),
('Servidor Game 02', 3, 1),
('Servidor Game 03', 3, 1);

-- 5. Servidor_Funcionario
INSERT INTO servidor_funcionario (fk_funcionario, fk_servidor) VALUES
(1, 1),
(2, 1),
(1, 2),
(3, 3),
(4, 3),
(5, 1),
(6, 2),
(7, 4),
(8, 5);

-- 6. Convite
INSERT INTO convite (id_convite, codigo, tipo_acesso, quantidade_uso, fk_empresa) VALUES
(1, 'INFRA-ADM-001', 'Administrador', 5, 1),
(2, 'INFRA-ANA-001', 'Analista', 10, 1),
(3, 'INFRA-ADM-001', 'Administrador', 5, 2),
(4, 'INFRA-ANA-001', 'Analista', 10, 2),
(5, 'INFRA-ANA-001', 'Analista', 5, 3);

-- 7. Componente
INSERT INTO componente (tipo, modelo, numero_serie, capacidade_total, unidade_capacidade, status_monitoramento, fk_servidor_componente) VALUES
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-001', 100.00, '%', 1, 1),
('ram', 'DDR4 128GB', 'SN-RAM-002', 128.00, 'GB', 1, 1),
('disco', 'SSD NVMe 2TB', 'SN-SSD-003', 2000.00, 'GB', 1, 1),
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-002', 100.00, '%', 1, 2),
('ram', 'DDR4 64GB', 'SN-RAM-003', 64.00, 'GB', 1, 2);

-- 8. Parâmetro de Monitoramento
INSERT INTO parametro_monitoramento (limite_atencao, limite_critico, fk_servidor_parametro) VALUES
(75.00, 90.00, 1),
(80.00, 95.00, 2),
(70.00, 85.00, 3);

-- 9. Métrica
INSERT INTO metrica (nome, unidade_medida, descricao, fk_componente, fk_parametro_monitoramento) VALUES
('Uso de CPU', '%', 'Percentual do processamento utilizado', 1, 1),
('Uso de Memória RAM', 'GB', 'Consumo de memória em Gigabytes', 2, 1),
('Uso de Disco', 'GB', 'Espaço ocupado em disco', 3, 1);