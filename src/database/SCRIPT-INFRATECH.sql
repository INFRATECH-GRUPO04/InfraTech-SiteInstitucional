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
  idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
  razaoSocial VARCHAR(100) NOT NULL,
  nomeFantasia VARCHAR(100) NOT NULL,
  cnpj CHAR(14) NOT NULL,
  segmento_atuacao VARCHAR(80) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  status_sistema TINYINT NOT NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fk_endereco INT,
    FOREIGN KEY (fk_endereco) 
    REFERENCES endereco(id_endereco)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`funcionario`
-- -----------------------------------------------------
CREATE TABLE funcionario (
  idFuncionario INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  tipoAcesso VARCHAR(20) NOT NULL DEFAULT 'FUNCIONARIO',
  nome VARCHAR(45) NULL,
  dataNascimento DATETIME NULL,
  email VARCHAR(45) NOT NULL,
  senha VARCHAR(45) NOT NULL,
  cpf CHAR(11) NULL,
  status_sistema TINYINT NOT NULL DEFAULT 1,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_funcionario_empresa
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor`
-- -----------------------------------------------------
CREATE TABLE servidor (
  idServidor INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  nome VARCHAR(45) NULL,
  status_sistema TINYINT NOT NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cfkEmpresa 
  FOREIGN KEY (fkEmpresa) 
  REFERENCES empresa(idEmpresa)
  );

-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_funcionario`
-- -----------------------------------------------------
-- Um funcionário SEM nenhuma linha aqui enxerga todos os
-- servidores da própria empresa. Uma linha aqui restringe a visão dele
-- apenas aos servidores vinculados. Isso vale só para tipoAcesso = FUNCIONARIO;
-- o gestor sempre vê tudo, independente desta tabela.
CREATE TABLE servidor_funcionario (
  fkFuncionario INT NOT NULL,
  fkServidor INT NOT NULL,
  PRIMARY KEY (fkFuncionario,fkServidor),
  CONSTRAINT fk_servidor_funcionario_funcionario1
    FOREIGN KEY (fkFuncionario)
    REFERENCES funcionario (idFuncionario),
  CONSTRAINT fk_servidor_funcionario_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES servidor (idServidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`convite`
-- -----------------------------------------------------
CREATE TABLE convite (
  idConvite INT PRIMARY KEY AUTO_INCREMENT NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  tipoAcesso VARCHAR(20) NOT NULL DEFAULT 'FUNCIONARIO',
  quantidadeUso INT NOT NULL,
  quantidadeUsada INT NOT NULL DEFAULT 0,
  criado DATETIME DEFAULT NOW(),
  fkEmpresa INT NOT NULL,
  CONSTRAINT fk_convite_empresa
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa));


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
    FOREIGN KEY (fk_servidor_componente) REFERENCES servidor(idServidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`parametro_monitoramento`
-- -----------------------------------------------------
CREATE TABLE parametro_monitoramento (
  id_parametro_monitoramento INT PRIMARY KEY AUTO_INCREMENT,
  limite_atencao DECIMAL(14,2) NOT NULL,
  limite_critico DECIMAL(14,2) NOT NULL,
	fk_servidor_parametro INT,
    FOREIGN KEY (fk_servidor_parametro) REFERENCES servidor(idServidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`metrica`
-- -----------------------------------------------------
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
('01310100', 'Avenida Paulista', 'Bela Vista', '1578', 'Sala 12', 'SP', 'São Paulo'),      -- id 1: InfraTech (empresa interna)
('02002000', 'Avenida Paulista', 'Bela Vista', '1500', 'Sala 42', 'SP', 'São Paulo'),      -- id 2: GameCloud
('03003000', 'Rua Augusta', 'Consolação', '500', 'Andar 3', 'SP', 'São Paulo'),            -- id 3: TechPlay
('50030230', 'Avenida Conde da Boa Vista', 'Boa Vista', '921', NULL, 'PE', 'Recife');      -- id 4: Arena Nordeste

-- 2. Empresa
INSERT INTO empresa (razaoSocial, nomeFantasia, cnpj, segmento_atuacao, email, telefone, status_sistema, fk_endereco) VALUES
('InfraTech Games Ltda', 'InfraTech Games', '12345678000195', 'Desenvolvimento de Jogos', 'contato@infratech.com', '11999990001', 1, 1),           -- id 1: empresa interna (nunca aparece no CRUD)
('GameCloud Servicos S.A.', 'GameCloud', '23456789000195', 'Hospedagem e Cloud', 'contato@gamecloud.com', '11999990002', 1, 2),                    -- id 2: cliente ativo
('TechPlay Tecnologia Ltda', 'TechPlay', '34567890000130', 'Sistemas e Softwares', 'contato@techplay.com', '11999990003', 1, 3),                   -- id 3: cliente ativo
('Arena Nordeste Servicos de Internet Ltda', 'Arena Nordeste', '60746948000112', 'Hospedagem e Cloud', 'contato@arenanordeste.com.br', '8140042020', 0, 4); -- id 4: cliente DESATIVADO, para testar reativação

-- 3. Funcionário
INSERT INTO funcionario (fkEmpresa, tipoAcesso, nome, dataNascimento, email, senha, cpf, status_sistema) VALUES
-- Empresa 1 (InfraTech) - equipe interna, só ADMIN
(1, 'ADMIN', 'Felipe Santos', '2007-04-12', 'felipe@infratech.com', '123456', '12345678901', 1),          -- id 1
(1, 'ADMIN', 'Manuella Arantes', '2007-01-15', 'manuella@infratech.com', '123456', '34567890123', 1),     -- id 2

-- Empresa 2 (GameCloud) - 1 gestor + 3 funcionários
(2, 'GESTOR', 'Alexandre Oliveira', '1997-06-03', 'alexandre@gamecloud.com', 'senha123', '28643895271', 1),        -- id 3: gestor, dados completos
(2, 'FUNCIONARIO', 'Bianca Souza', '1999-02-10', 'bianca@gamecloud.com', '123456', '11122233396', 1),              -- id 4: ativo, terá vínculo restrito a 1 servidor
(2, 'FUNCIONARIO', 'Caio Lima', '1998-05-12', 'caio@gamecloud.com', '123456', '22233344495', 0),                   -- id 5: DESATIVADO
(2, 'FUNCIONARIO', NULL, NULL, 'diego.temp@gamecloud.com', 'trocar123', NULL, 1),                                  -- id 6: cadastro incompleto (só login, criado por token)

-- Empresa 3 (TechPlay) - 1 gestor + 3 funcionários
(3, 'GESTOR', 'Luana Pereira', '2003-03-18', 'luana@techplay.com', 'senhaLp1', '94784210876', 1),                  -- id 7: gestor, dados completos
(3, 'FUNCIONARIO', 'Rafael Nunes', '1995-09-01', 'rafael@techplay.com', '123456', '33344455516', 1),               -- id 8: ativo, sem vínculo -> vê todos os servidores da empresa
(3, 'FUNCIONARIO', 'Debora Martins', '2000-12-20', 'debora@techplay.com', '123456', '44455566627', 1),             -- id 9: ativo, terá vínculo restrito a 1 servidor
(3, 'FUNCIONARIO', 'Fernanda Melo', '1994-07-08', 'fernanda@techplay.com', '123456', '55566677738', 1),            -- id 10: ativo, sem vínculo -> vê todos os servidores da empresa

-- Empresa 4 (Arena Nordeste, DESATIVADA) - 1 gestor + 3 funcionários
(4, 'GESTOR', NULL, NULL, 'gestor@arenanordeste.com.br', 'trocarSenha1', NULL, 1),                                 -- id 11: gestor criado só com login (contrato recém-fechado)
(4, 'FUNCIONARIO', 'Igor Ramos', '1996-11-23', 'igor@arenanordeste.com.br', '123456', '66677788849', 1),           -- id 12: ativo
(4, 'FUNCIONARIO', 'Juliana Prado', '1993-04-17', 'juliana@arenanordeste.com.br', '123456', '77788899950', 0),     -- id 13: DESATIVADO
(4, 'FUNCIONARIO', 'Kaique Silva', '2001-01-30', 'kaique@arenanordeste.com.br', '123456', '88899900061', 1);       -- id 14: ativo

-- 4. Servidor
INSERT INTO servidor (nome, fkEmpresa, status_sistema) VALUES
('SRV-INFRA-01', 1, 1),          -- id 1: InfraTech (uso interno)
('SRV-INFRA-02', 1, 1),          -- id 2: InfraTech (uso interno)
('SRV-GAMECLOUD-01', 2, 1),      -- id 3: GameCloud, ativo
('SRV-GAMECLOUD-02', 2, 1),      -- id 4: GameCloud, ativo
('SRV-GAMECLOUD-LEGADO', 2, 0),  -- id 5: GameCloud, desativado (fora de uso)
('SRV-TECHPLAY-01', 3, 1),       -- id 6: TechPlay, ativo
('SRV-TECHPLAY-02', 3, 1),       -- id 7: TechPlay, ativo
('SRV-ARENA-01', 4, 1);          -- id 8: Arena Nordeste, ativo

-- 5. Servidor_Funcionario
INSERT INTO servidor_funcionario (fkFuncionario, fkServidor) VALUES
(4, 3),   -- Bianca (GameCloud) só vê o SRV-GAMECLOUD-01
(9, 6);   -- Debora (TechPlay) só vê o SRV-TECHPLAY-01

-- 6. Convite
INSERT INTO convite (codigo, tipoAcesso, quantidadeUso, quantidadeUsada, fkEmpresa) VALUES
('B4E19F', 'FUNCIONARIO', 10, 4, 2),  -- GameCloud: convite em uso, ainda com vagas
('7C2AD0', 'FUNCIONARIO', 5, 5, 3),   -- TechPlay: convite esgotado (usos = limite)
('F0913B', 'FUNCIONARIO', 3, 0, 4);   -- Arena Nordeste: convite recém-gerado, ainda sem uso

-- 7. Componente (Vinculados diretamente ao Servidor)
INSERT INTO componente (tipo, modelo, numero_serie, capacidade_total, unidade_capacidade, status_monitoramento, fk_servidor_componente) VALUES
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-001', 100.00, '%', 1, 3),    -- SRV-GAMECLOUD-01
('ram', 'DDR4 128GB', 'SN-RAM-002', 128.00, 'GB', 1, 3),           -- SRV-GAMECLOUD-01
('disco', 'SSD NVMe 2TB', 'SN-SSD-003', 2000.00, 'GB', 1, 3),      -- SRV-GAMECLOUD-01
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-002', 100.00, '%', 1, 4),    -- SRV-GAMECLOUD-02
('ram', 'DDR4 64GB', 'SN-RAM-003', 64.00, 'GB', 1, 4),             -- SRV-GAMECLOUD-02
('cpu', 'AMD EPYC 7302', 'SN-CPU-004', 100.00, '%', 1, 6);         -- SRV-TECHPLAY-01

-- 8. Parâmetro de Monitoramento
INSERT INTO parametro_monitoramento (limite_atencao, limite_critico, fk_servidor_parametro) VALUES
(75.00, 90.00, 3),   -- SRV-GAMECLOUD-01
(80.00, 95.00, 4),   -- SRV-GAMECLOUD-02
(70.00, 85.00, 6);   -- SRV-TECHPLAY-01

-- 9. Métrica
INSERT INTO metrica (nome, unidade_medida, descricao, fk_componente, fk_parametro_monitoramento) VALUES
('Uso de CPU', '%', 'Percentual do processamento utilizado', 1, 1),
('Uso de Memória RAM', 'GB', 'Consumo de memória em Gigabytes', 2, 1),
('Uso de Disco', 'GB', 'Espaço ocupado em disco', 3, 1);
