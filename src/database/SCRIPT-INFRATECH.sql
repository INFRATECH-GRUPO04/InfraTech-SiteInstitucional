-- =====================================================
-- CRIACAO E SELECAO DO BANCO DE DADOS
-- =====================================================

CREATE DATABASE infratech;

USE infratech;


-- =====================================================
-- TABELA: endereco
-- FINALIDADE: Armazena os enderecos das empresas.
-- =====================================================

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


-- =====================================================
-- TABELA: empresa
-- FINALIDADE: Armazena os dados cadastrais das empresas.
-- RELACIONAMENTO: fk_endereco referencia a tabela endereco.
-- =====================================================

CREATE TABLE empresa (
    id_empresa INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(100) NOT NULL,
    nome_fantasia VARCHAR(100) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    segmento_atuacao VARCHAR(80) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    status_sistema TINYINT NOT NULL,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fk_endereco INT,

    FOREIGN KEY (fk_endereco)
        REFERENCES endereco(id_endereco)
);


-- =====================================================
-- TABELA: funcionario
-- FINALIDADE: Armazena os funcionarios e seus dados
-- de acesso ao sistema.
-- RELACIONAMENTO: Cada funcionario pertence a uma empresa.
-- =====================================================

CREATE TABLE funcionario (
    id_funcionario INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    tipo_acesso ENUM('GESTOR', 'ADMIN', 'FUNCIONARIO')
        NOT NULL DEFAULT 'FUNCIONARIO',
    nome VARCHAR(45) NULL,
    data_nascimento DATETIME NULL,
    email VARCHAR(45) NOT NULL,
    senha VARCHAR(45) NOT NULL,
    cpf CHAR(11) NULL,
    status_sistema TINYINT NOT NULL DEFAULT 1,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_funcionario_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);


-- =====================================================
-- TABELA: servidor
-- FINALIDADE: Registra os servidores monitorados.
-- RELACIONAMENTO: Cada servidor pertence a uma empresa.
-- =====================================================

CREATE TABLE servidor (
    id_servidor INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    nome VARCHAR(45) NULL,
    status_sistema TINYINT NOT NULL DEFAULT 1,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- VERIFICAÇÕES PARA O SCRIPT DE CAPTURA:
    chave_hash CHAR(64) NULL UNIQUE,
    dt_ultimo_envio DATETIME NULL,

    CONSTRAINT cfk_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);


-- =====================================================
-- TABELA: servidor_funcionario
-- FINALIDADE: Relaciona funcionarios aos servidores
-- aos quais possuem acesso.
-- RELACIONAMENTO: Muitos-para-muitos entre funcionario
-- e servidor.
-- CHAVE PRIMARIA: Composta pelas duas chaves estrangeiras.
-- =====================================================

CREATE TABLE servidor_funcionario (
    fk_funcionario INT NOT NULL,
    fk_servidor INT NOT NULL,

    PRIMARY KEY (fk_funcionario, fk_servidor),

    CONSTRAINT fk_servidor_funcionario_funcionario1
        FOREIGN KEY (fk_funcionario)
        REFERENCES funcionario(id_funcionario),

    CONSTRAINT fk_servidor_funcionario_servidor1
        FOREIGN KEY (fk_servidor)
        REFERENCES servidor(id_servidor)
);


-- =====================================================
-- TABELA: convite
-- FINALIDADE: Armazena codigos de convite utilizados
-- para permitir o cadastro de usuarios.
-- RELACIONAMENTO: Cada convite pertence a uma empresa.
-- =====================================================

CREATE TABLE convite (
    id_convite INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(100) NOT NULL,
    tipo_acesso VARCHAR(20) NOT NULL DEFAULT 'FUNCIONARIO',
    quantidade_uso INT NOT NULL,
    quantidade_usada INT NOT NULL DEFAULT 0,
    criado DATETIME DEFAULT NOW(),
    fk_empresa INT NOT NULL,

    CONSTRAINT fk_convite_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);


-- =====================================================
-- TABELA: componente
-- FINALIDADE: Registra os componentes de hardware
-- dos servidores, como CPU, RAM, disco e rede.
-- RELACIONAMENTO: Cada componente pertence a um servidor.
-- =====================================================

CREATE TABLE componente (
    id_componente INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(45) NOT NULL,
    modelo VARCHAR(100),
    numero_serie VARCHAR(100),
    capacidade_total DECIMAL(14,2),
    unidade_capacidade VARCHAR(45),
    status_monitoramento TINYINT NOT NULL DEFAULT 1,
    entrada_sistema DATETIME DEFAULT CURRENT_TIMESTAMP,
    fk_servidor INT NOT NULL,

    FOREIGN KEY (fk_servidor)
        REFERENCES servidor(id_servidor)
);


-- =====================================================
-- TABELA: metrica
-- FINALIDADE: Define quais metricas serao monitoradas
-- em cada componente e seus limites de alerta.
-- OBSERVACAO: Armazena a configuracao da metrica,
-- nao o historico dos valores coletados.
-- RELACIONAMENTO: Cada metrica pertence a um componente.
-- =====================================================

CREATE TABLE metrica (
    id_metrica INT PRIMARY KEY AUTO_INCREMENT,
    fk_componente INT NOT NULL,
    nome VARCHAR(60) NOT NULL,
    unidade VARCHAR(20) NOT NULL,
    limite_atencao DECIMAL(14,2),
    limite_critico DECIMAL(14,2),
    status_monitoramento TINYINT NOT NULL DEFAULT 1,

    FOREIGN KEY (fk_componente)
        REFERENCES componente(id_componente)
);


-- =====================================================
-- INSERCAO DE DADOS: endereco
-- FINALIDADE: Cadastra os enderecos das empresas.
-- =====================================================

INSERT INTO endereco (
    cep,
    logradouro,
    bairro,
    numero,
    complemento,
    estado,
    cidade
) VALUES
('01310100', 'Avenida Paulista', 'Bela Vista', '1578', 'Sala 12', 'SP', 'São Paulo'),
('02002000', 'Avenida Paulista', 'Bela Vista', '1500', 'Sala 42', 'SP', 'São Paulo'),
('03003000', 'Rua Augusta', 'Consolação', '500', 'Andar 3', 'SP', 'São Paulo'),
('50030230', 'Avenida Conde da Boa Vista', 'Boa Vista', '921', NULL, 'PE', 'Recife');


-- =====================================================
-- INSERCAO DE DADOS: empresa
-- FINALIDADE: Cadastra as empresas clientes da InfraTech.
-- =====================================================

INSERT INTO empresa (
    razao_social,
    nome_fantasia,
    cnpj,
    segmento_atuacao,
    email,
    telefone,
    status_sistema,
    fk_endereco
) VALUES
('InfraTech Games Ltda', 'InfraTech Games', '12345678000195', 'Desenvolvimento de Jogos', 'contato@infratech.com', '11999990001', 1, 1),
('GameCloud Servicos S.A.', 'GameCloud', '23456789000195', 'Hospedagem e Cloud', 'contato@gamecloud.com', '11999990002', 1, 2),
('TechPlay Tecnologia Ltda', 'TechPlay', '34567890000130', 'Sistemas e Softwares', 'contato@techplay.com', '11999990003', 1, 3),
('Arena Nordeste Servicos de Internet Ltda', 'Arena Nordeste', '60746948000112', 'Hospedagem e Cloud', 'contato@arenanordeste.com.br', '8140042020', 0, 4);


-- =====================================================
-- INSERCAO DE DADOS: funcionario
-- FINALIDADE: Cadastra os funcionarios e seus niveis
-- de acesso ao sistema.
-- =====================================================

INSERT INTO funcionario (
    fk_empresa,
    tipo_acesso,
    nome,
    data_nascimento,
    email,
    senha,
    cpf,
    status_sistema
) VALUES
(1, 'ADMIN', 'Felipe Santos', '2007-04-12', 'felipe@infratech.com', '123456', '12345678901', 1),
(1, 'ADMIN', 'Manuella Arantes', '2007-01-15', 'manuella@infratech.com', '123456', '34567890123', 1),
(2, 'GESTOR', 'Alexandre Oliveira', '1997-06-03', 'alexandre@gamecloud.com', 'senha123', '28643895271', 1),
(2, 'FUNCIONARIO', 'Bianca Souza', '1999-02-10', 'bianca@gamecloud.com', '  ', '11122233396', 1),
(2, 'FUNCIONARIO', 'Caio Lima', '1998-05-12', 'caio@gamecloud.com', '123456', '22233344495', 0),
(2, 'FUNCIONARIO', NULL, NULL, 'diego.temp@gamecloud.com', 'trocar123', NULL, 1),
(3, 'GESTOR', 'Luana Pereira', '2003-03-18', 'luana@techplay.com', 'senhaLp1', '94784210876', 1),
(3, 'FUNCIONARIO', 'Rafael Nunes', '1995-09-01', 'rafael@techplay.com', '123456', '33344455516', 1),
(3, 'FUNCIONARIO', 'Debora Martins', '2000-12-20', 'debora@techplay.com', '123456', '44455566627', 1),
(3, 'FUNCIONARIO', 'Fernanda Melo', '1994-07-08', 'fernanda@techplay.com', '123456', '55566677738', 1),
(4, 'GESTOR', NULL, NULL, 'gestor@arenanordeste.com.br', 'trocarSenha1', NULL, 1),
(4, 'FUNCIONARIO', 'Igor Ramos', '1996-11-23', 'igor@arenanordeste.com.br', '123456', '66677788849', 1),
(4, 'FUNCIONARIO', 'Juliana Prado', '1993-04-17', 'juliana@arenanordeste.com.br', '123456', '77788899950', 0),
(4, 'FUNCIONARIO', 'Kaique Silva', '2001-01-30', 'kaique@arenanordeste.com.br', '123456', '88899900061', 1);


-- =====================================================
-- INSERCAO DE DADOS: servidor
-- FINALIDADE: Cadastra os servidores e seus vinculos
-- com as empresas.
-- =====================================================

INSERT INTO servidor (
    nome,
    fk_empresa,
    status_sistema
) VALUES
('SRV-INFRA-01', 1, 1),
('SRV-INFRA-02', 1, 1),
('SRV-GAMECLOUD-01', 2, 1),
('SRV-GAMECLOUD-02', 2, 1),
('SRV-GAMECLOUD-LEGADO', 2, 0),
('SRV-TECHPLAY-01', 3, 1),
('SRV-TECHPLAY-02', 3, 1),
('SRV-ARENA-01', 4, 1);


-- =====================================================
-- INSERCAO DE DADOS: servidor_funcionario
-- FINALIDADE: Define os vinculos de acesso entre
-- funcionarios e servidores.
-- =====================================================

INSERT INTO servidor_funcionario (
    fk_funcionario,
    fk_servidor
) VALUES
(4, 3),
(9, 6);


-- =====================================================
-- INSERCAO DE DADOS: convite
-- FINALIDADE: Cadastra os codigos de convite e define
-- os limites de utilizacao de cada codigo.
-- =====================================================

INSERT INTO convite (
    codigo,
    tipo_acesso,
    quantidade_uso,
    quantidade_usada,
    fk_empresa
) VALUES
('B4E19F', 'FUNCIONARIO', 10, 4, 2),
('7C2AD0', 'FUNCIONARIO', 5, 5, 3),
('F0913B', 'FUNCIONARIO', 3, 0, 4);


-- =====================================================
-- INSERCAO DE DADOS: componente
-- FINALIDADE: Cadastra os componentes de hardware
-- existentes nos servidores monitorados.
-- =====================================================

INSERT INTO componente (
    tipo,
    modelo,
    numero_serie,
    capacidade_total,
    unidade_capacidade,
    status_monitoramento,
    fk_servidor
) VALUES
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-001', 100.00, '%', 1, 3),
('ram', 'DDR4 128GB', 'SN-RAM-002', 128.00, 'GB', 1, 3),
('disco', 'SSD NVMe 2TB', 'SN-SSD-003', 2000.00, 'GB', 1, 3),
('cpu', 'Intel Xeon E5-2680', 'SN-CPU-002', 100.00, '%', 1, 4),
('ram', 'DDR4 64GB', 'SN-RAM-003', 64.00, 'GB', 1, 4),
('cpu', 'AMD EPYC 7302', 'SN-CPU-004', 100.00, '%', 1, 6),
('rede', 'Intel X550 10GbE', 'SN-NET-001', 10000.00, 'Mbps', 1, 3);


-- =====================================================
-- INSERCAO DE DADOS: metrica
-- FINALIDADE: Configura as metricas monitoradas,
-- suas unidades e os limites de atencao e criticidade.
-- =====================================================

INSERT INTO metrica (
    fk_componente,
    nome,
    unidade,
    limite_atencao,
    limite_critico
) VALUES
(1, 'uso_percentual', '%', 75.00, 90.00),
(2, 'uso_percentual', '%', 75.00, 90.00),
(3, 'uso_percentual', '%', 75.00, 90.00),
(4, 'uso_percentual', '%', 80.00, 95.00),
(5, 'uso_percentual', '%', 80.00, 95.00),
(6, 'uso_percentual', '%', 70.00, 85.00),
(7, 'perda_pacotes', '%', 1.00, 5.00),
(7, 'latencia', 'ms', 50.00, 100.00),
(7, 'bytes_enviados_seg', 'B/s', NULL, NULL),
(7, 'bytes_recebidos_seg', 'B/s', NULL, NULL);