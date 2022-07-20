import { initializeDataSource } from "../../../__tests__/helpers/db/test-hooks";
import test from "ava";
import { useTransaction } from "../../../__tests__/helpers/db/query-runner";
import { CreateCS } from "../../../__tests__/helpers/db/create-cs-files";
import { v4 } from "uuid";
import { CloudStorageFileService } from "../file";
import { CloudStorageInfoService } from "../info";
import { FilesInfoBasic } from "../directory.type";
import { FileResourceType } from "../../../../model/cloudStorage/Constants";
import { FError } from "../../../../error/ControllerError";
import { Status } from "../../../../constants/Project";
import { ErrorCode } from "../../../../ErrorCode";

const namespace = "v2.services.cloud-storage.file";

initializeDataSource(test, namespace);

test(`${namespace} - move`, async ava => {
    const { t } = await useTransaction();

    const userUUID = v4();
    const [d1, d2] = await CreateCS.createDirectories(userUUID, "/", 2);
    const [f1, f2] = await CreateCS.createFiles(userUUID, d1.directoryPath, 2);

    const cloudStorageInfoSVC = new CloudStorageInfoService(v4(), t, userUUID);
    const filesInfo = await cloudStorageInfoSVC.findFilesInfo();
    const cloudStorageFileSVC = new CloudStorageFileService(v4(), t, userUUID);
    await cloudStorageFileSVC.move(filesInfo, d1.directoryPath, d2.directoryPath, [
        f1.fileUUID,
        f2.fileUUID,
    ]);

    const [l1, l2] = await Promise.all([
        cloudStorageInfoSVC.list({
            order: "DESC",
            page: 1,
            size: 10,
            directoryPath: d1.directoryPath,
        }),
        cloudStorageInfoSVC.list({
            order: "DESC",
            page: 1,
            size: 10,
            directoryPath: d2.directoryPath,
        }),
    ]);

    ava.is(l1.length, 0);
    ava.is(l2.length, 2);
    ava.is(l2[0].fileUUID, f2.fileUUID);
    ava.is(l2[1].fileUUID, f1.fileUUID);
});

test(`${namespace} - move - file path too long`, async ava => {
    const { t } = await useTransaction();
    const userUUID = v4();

    const filesInfo: FilesInfoBasic[] = [
        {
            fileUUID: v4(),
            fileName: "v",
            directoryPath: "/",
            resourceType: FileResourceType.OnlineCourseware,
        },
        {
            fileUUID: v4(),
            fileName: "a".repeat(395),
            directoryPath: "/",
            resourceType: FileResourceType.WhiteboardProjector,
        },
    ];
    const cloudStorageFileSVC = new CloudStorageFileService(v4(), t, userUUID);

    await ava.throwsAsync(
        cloudStorageFileSVC.move(
            filesInfo,
            "/",
            `/${v4()}/`,
            filesInfo.map(item => item.fileUUID),
        ),
        {
            instanceOf: FError,
            message: `${Status.Failed}: ${ErrorCode.ParamsCheckFailed}`,
        },
    );
});

test(`${namespace} - move - path is same`, async ava => {
    const { t } = await useTransaction();
    const cloudStorageFileSVC = new CloudStorageFileService(v4(), t, v4());

    await cloudStorageFileSVC.move([], "/", "/", [""]);
    ava.pass();
});
