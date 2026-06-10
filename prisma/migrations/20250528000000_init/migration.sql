-- CreateTable
CREATE TABLE "estado" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "sigla" TEXT NOT NULL,
    CONSTRAINT "estado_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "municipio" (
    "id" SERIAL NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "estado_id" INTEGER NOT NULL,
    CONSTRAINT "municipio_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "municipio" ADD CONSTRAINT "municipio_estado_id_fkey"
    FOREIGN KEY ("estado_id") REFERENCES "estado"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
