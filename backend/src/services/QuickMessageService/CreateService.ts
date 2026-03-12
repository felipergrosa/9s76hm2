import * as Yup from "yup";
import AppError from "../../errors/AppError";
import QuickMessage from "../../models/QuickMessage";

interface Data {
  shortcode: string;
  message: string;
  companyId: number | string;
  userId: number | string;
  geral: boolean;
  isMedia: boolean;
  mediaPath?: string | null;
  visao: boolean;
  groupName?: string;
  color?: string;
  delay?: number;
  sendAsCaption?: boolean;
  flow?: string;
}

const CreateService = async (data: Data): Promise<QuickMessage> => {
  const { shortcode, message, isMedia } = data;

  const ticketnoteSchema = Yup.object().shape({
    shortcode: Yup.string()
      .min(1, "ERR_QUICKMESSAGE_INVALID_NAME")
      .required("ERR_QUICKMESSAGE_REQUIRED"),
    message: isMedia ? Yup.string().notRequired() : Yup.string()
      .min(3, "ERR_QUICKMESSAGE_INVALID_NAME")
      .required("ERR_QUICKMESSAGE_REQUIRED")
  });

  try {
    await ticketnoteSchema.validate({ shortcode, message });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  const record = await QuickMessage.create(data);

  if (data.groupName && data.color) {
    await QuickMessage.update(
      { color: data.color },
      {
        where: {
          groupName: data.groupName,
          companyId: data.companyId
        }
      }
    );
  }

  return record;
};

export default CreateService;
