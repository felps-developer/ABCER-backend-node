-- CreateTable
CREATE TABLE "socio" (
    "id" SERIAL NOT NULL,
    "cpf_cnpj" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "telefone" TEXT,
    "email" TEXT NOT NULL,
    "documento_full_path" TEXT,
    "tipo_pessoa" INTEGER NOT NULL,
    "tipo_socio" INTEGER NOT NULL,
    "concordou_estatuto" BOOLEAN NOT NULL,
    "logradouro" TEXT,
    "numero" INTEGER,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "municipio_id" INTEGER,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "socio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unidade_consumidora" (
    "id" SERIAL NOT NULL,
    "numero_cliente" TEXT NOT NULL,
    "numero_uc" TEXT NOT NULL,
    "fatura_full_path" TEXT,
    "socio_id" INTEGER NOT NULL,
    "logradouro" TEXT,
    "numero" INTEGER,
    "complemento" TEXT,
    "bairro" TEXT,
    "cep" TEXT,
    "municipio_id" INTEGER,
    "data_criacao" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data_alteracao" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unidade_consumidora_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "usuario" ADD COLUMN "socio" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "usuario_socio_key" ON "usuario"("socio");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_socio_fkey" FOREIGN KEY ("socio") REFERENCES "socio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unidade_consumidora" ADD CONSTRAINT "unidade_consumidora_socio_id_fkey" FOREIGN KEY ("socio_id") REFERENCES "socio"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
